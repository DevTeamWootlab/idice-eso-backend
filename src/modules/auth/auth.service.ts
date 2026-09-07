import {
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThan, Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import { randomUUID } from 'crypto';

import { UsersService } from '../users/users.service';
import { RefreshToken } from './entities/refresh-token.entity';
import { EmailVerificationToken } from './entities/email-verification-token.entity';
import { PasswordResetToken } from './entities/password-reset-token.entity';
import { LoginAttempt } from './entities/login-attempt.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { MfaService } from './mfa.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { Role } from '../../common/enums/role.enum';
import { JwtPayload } from '../../common/interfaces/jwt-payload.interface';

interface RequestMeta {
  ipAddress?: string;
  userAgent?: string;
}

const INTERNAL_ROLES = [
  Role.ELIGIBILITY_REVIEWER,
  Role.SCORING_REVIEWER,
  Role.VALIDATOR,
  Role.SYSADMIN,
];

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly notificationsService: NotificationsService,
    private readonly mfaService: MfaService,
    @InjectRepository(RefreshToken)
    private readonly refreshTokenRepo: Repository<RefreshToken>,
    @InjectRepository(EmailVerificationToken)
    private readonly verificationRepo: Repository<EmailVerificationToken>,
    @InjectRepository(PasswordResetToken)
    private readonly resetTokenRepo: Repository<PasswordResetToken>,
    @InjectRepository(LoginAttempt)
    private readonly loginAttemptRepo: Repository<LoginAttempt>,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.usersService.findByEmail(dto.email);
    if (existing) {
      throw new ConflictException('An account with this email already exists');
    }

    const passwordHash = await argon2.hash(dto.password);
    const user = await this.usersService.create({
      email: dto.email,
      passwordHash,
      fullName: dto.fullName,
      role: Role.ESO,
    });

    // Create application record for the new ESO user (not shown here, but would be part of the application service)

    await this.sendVerificationEmail(user.id, user.email);
    return {
      id: user.id,
      email: user.email,
      message: 'Registration successful, please verify your email',
    };
  }

  async sendVerificationEmail(userId: string, email: string) {
    const token = randomUUID();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await this.verificationRepo.save(
      this.verificationRepo.create({ userId, token, expiresAt }),
    );
    await this.notificationsService.sendEmailVerification(email, token);
  }

  async verifyEmail(token: string) {
    const record = await this.verificationRepo.findOne({ where: { token } });
    if (!record || record.used || record.expiresAt < new Date()) {
      throw new BadRequestException(
        'Verification link is invalid or has expired',
      );
    }
    await this.usersService.markEmailVerified(record.userId);
    record.used = true;
    await this.verificationRepo.save(record);
    return { message: 'Email verified successfully' };
  }

  async login(dto: LoginDto, meta: RequestMeta = {}) {
    await this.assertNotLockedOut(dto.email);

    const user = await this.usersService.findByEmail(dto.email);
    const passwordValid = user
      ? await argon2.verify(user.passwordHash, dto.password)
      : false;

    await this.loginAttemptRepo.save(
      this.loginAttemptRepo.create({
        email: dto.email,
        successful: passwordValid,
        ipAddress: meta.ipAddress,
      }),
    );

    if (!user || !passwordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }
    if (!user.isActive) {
      throw new UnauthorizedException('This account has been deactivated');
    }
    if (!user.isEmailVerified) {
      throw new UnauthorizedException(
        'Please verify your email before logging in',
      );
    }

    // internal roles cannot get a full session without MFA — force setup if it's missing
    if (INTERNAL_ROLES.includes(user.role) && !user.mfaEnabled) {
      return {
        mfaSetupRequired: true,
        setupToken: this.signShortLivedToken(user.id, 'mfa_setup'),
      };
    }

    if (user.mfaEnabled) {
      return {
        mfaRequired: true,
        mfaToken: this.signShortLivedToken(user.id, 'mfa_verify'),
      };
    }

    return this.issueTokenPair(user.id, user.email, user.role, meta);
  }

  async verifyMfaAndLogin(
    mfaToken: string,
    code: string,
    meta: RequestMeta = {},
  ) {
    const userId = this.verifyShortLivedToken(mfaToken, 'mfa_verify');

    const valid = await this.mfaService.verifyCode(userId, code);
    if (!valid) {
      throw new UnauthorizedException('Invalid or expired MFA code');
    }

    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new NotFoundException('User not Found');
    }

    return this.issueTokenPair(user.id, user.email, user.role, meta);
  }

  async refresh(payload: JwtPayload & { rawRefreshToken: string }) {
    const { sub: userId, sessionId, rawRefreshToken } = payload;
    if (!sessionId) throw new UnauthorizedException('Malformed refresh token');

    const stored = await this.refreshTokenRepo.findOne({
      where: { userId, sessionId },
    });
    if (!stored || stored.revoked) {
      throw new UnauthorizedException(
        'Session is no longer valid, please log in again',
      );
    }
    if (stored.expiresAt < new Date()) {
      throw new UnauthorizedException(
        'Session has expired, please log in again',
      );
    }

    const matches = await argon2.verify(stored.tokenHash, rawRefreshToken);
    if (!matches) {
      await this.refreshTokenRepo.update({ sessionId }, { revoked: true });
      throw new UnauthorizedException(
        'Session is no longer valid, please log in again',
      );
    }

    const user = await this.usersService.findById(userId);
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Account is no longer active');
    }

    const newRefreshToken = this.signRefreshToken(
      user.id,
      user.email,
      user.role,
      sessionId,
    );
    stored.tokenHash = await argon2.hash(newRefreshToken);
    stored.expiresAt = this.getRefreshExpiryDate();
    await this.refreshTokenRepo.save(stored);

    const accessToken = this.signAccessToken(user.id, user.email, user.role);
    return { accessToken, refreshToken: newRefreshToken };
  }

  async logout(refreshToken: string) {
    let payload: JwtPayload;
    try {
      payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.get<string>('jwt.refreshSecret'),
      });
    } catch {
      return { message: 'Logged out' };
    }
    if (payload.sessionId) {
      await this.refreshTokenRepo.update(
        { userId: payload.sub, sessionId: payload.sessionId },
        { revoked: true },
      );
    }
    return { message: 'Logged out' };
  }

  async logoutAll(userId: string) {
    await this.refreshTokenRepo.update(
      { userId, revoked: false },
      { revoked: true },
    );
    return { message: 'Logged out of all sessions' };
  }

  async listSessions(userId: string) {
    const sessions = await this.refreshTokenRepo.find({
      where: { userId, revoked: false },
      order: { createdAt: 'DESC' },
    });
    return sessions.map((s) => ({
      sessionId: s.sessionId,
      userAgent: s.userAgent,
      ipAddress: s.ipAddress,
      createdAt: s.createdAt,
      expiresAt: s.expiresAt,
    }));
  }

  // never reveal whether the email exists — same response either way
  async forgotPassword(email: string) {
    const user = await this.usersService.findByEmail(email);
    if (user) {
      const token = randomUUID();
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1h
      await this.resetTokenRepo.save(
        this.resetTokenRepo.create({ userId: user.id, token, expiresAt }),
      );
      await this.notificationsService.sendPasswordReset(user.email, token);
    }
    return {
      message:
        'If an account exists for this email, a reset link has been sent',
    };
  }

  async resetPassword(token: string, newPassword: string) {
    const record = await this.resetTokenRepo.findOne({ where: { token } });
    if (!record || record.used || record.expiresAt < new Date()) {
      throw new BadRequestException('Reset link is invalid or has expired');
    }

    const passwordHash = await argon2.hash(newPassword);
    await this.usersService.updatePassword(record.userId, passwordHash);

    record.used = true;
    await this.resetTokenRepo.save(record);

    // a password reset invalidates every existing session
    await this.logoutAll(record.userId);

    return { message: 'Password reset successfully, please log in again' };
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ) {
    const user = await this.usersService.findById(userId);

    if (!user) {
      throw new NotFoundException('User not Found');
    }
    const valid = await argon2.verify(user.passwordHash, currentPassword);
    if (!valid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    const passwordHash = await argon2.hash(newPassword);
    await this.usersService.updatePassword(userId, passwordHash);
    await this.logoutAll(userId); // force re-login on every device after a password change too

    return { message: 'Password changed successfully' };
  }

  private async assertNotLockedOut(email: string) {
    const windowMinutes = this.configService.getOrThrow<number>(
      'security.lockoutWindowMinutes',
    );
    const maxAttempts = this.configService.getOrThrow<number>(
      'security.lockoutMaxAttempts',
    );
    const since = new Date(Date.now() - windowMinutes * 60 * 1000);

    const recentFailures = await this.loginAttemptRepo.count({
      where: { email, successful: false, createdAt: MoreThan(since) },
    });

    if (recentFailures >= maxAttempts) {
      throw new ForbiddenException(
        `Too many failed login attempts. Please try again in ${this.configService.get<number>('security.lockoutDurationMinutes')} minutes.`,
      );
    }
  }

  private signShortLivedToken(userId: string, purpose: string): string {
    return this.jwtService.sign(
      { sub: userId, purpose },
      {
        secret: this.configService.get<string>('jwt.accessSecret'),
        expiresIn: '5m',
      },
    );
  }

  private verifyShortLivedToken(
    token: string,
    expectedPurpose: string,
  ): string {
    try {
      const payload = this.jwtService.verify<{ sub: string; purpose: string }>(
        token,
        {
          secret: this.configService.get<string>('jwt.accessSecret'),
        },
      );
      if (payload.purpose !== expectedPurpose) {
        throw new UnauthorizedException('Invalid token');
      }
      return payload.sub;
    } catch {
      throw new UnauthorizedException('Token is invalid or has expired');
    }
  }

  async verifyPassword(userId: string, password: string): Promise<boolean> {
    const user = await this.usersService.findById(userId);
    if (!user) return false;
    return argon2.verify(user.passwordHash, password);
  }

  verifySetupToken(token: string): string {
    return this.verifyShortLivedToken(token, 'mfa_setup');
  }

  private async issueTokenPair(
    userId: string,
    email: string,
    role: Role,
    meta: RequestMeta,
  ) {
    const sessionId = randomUUID();
    const accessToken = this.signAccessToken(userId, email, role);
    const refreshToken = this.signRefreshToken(userId, email, role, sessionId);
    const tokenHash = await argon2.hash(refreshToken);

    await this.refreshTokenRepo.save(
      this.refreshTokenRepo.create({
        userId,
        sessionId,
        tokenHash,
        expiresAt: this.getRefreshExpiryDate(),
        userAgent: meta.userAgent,
        ipAddress: meta.ipAddress,
      }),
    );

    return { accessToken, refreshToken };
  }

  private signAccessToken(userId: string, email: string, role: Role): string {
    const payload: JwtPayload = { sub: userId, email, role };

    return this.jwtService.sign(payload as Record<string, any>, {
      secret: this.configService.getOrThrow<string>('jwt.accessSecret'),
      expiresIn: this.configService.getOrThrow<string>(
        'jwt.accessExpiresIn',
      ) as any,
    });
  }

  private signRefreshToken(
    userId: string,
    email: string,
    role: Role,
    sessionId: string,
  ): string {
    const payload: JwtPayload = { sub: userId, email, role, sessionId };

    return this.jwtService.sign(payload as Record<string, any>, {
      secret: this.configService.getOrThrow<string>('jwt.refreshSecret'),
      expiresIn: this.configService.getOrThrow<string>(
        'jwt.refreshExpiresIn',
      ) as any,
    });
  }

  private getRefreshExpiryDate(): Date {
    return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  }
}
