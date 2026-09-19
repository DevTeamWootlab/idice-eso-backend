import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import { ProvisionInternalUserDto } from './dto/provision-internal-user.dto';
import { Role } from '@/common/enums/role.enum';
import { randomUUID } from 'crypto';
import { NotificationsService } from '../notifications/notifications.service';
import { EmailVerificationToken } from '../auth/entities/email-verification-token.entity';

// The four roles UsersController's GET / and PATCH /:id/status are meant to manage —
// ROLE_ESO applicants always go through self-registration (POST /auth/register), never
// through here, so this list doubles as a guard against a crafted ?role=ROLE_ESO query.
const INTERNAL_ROLES = [
  Role.ELIGIBILITY_REVIEWER,
  Role.SCORING_REVIEWER,
  Role.VALIDATOR,
  Role.SYSADMIN,
];

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(EmailVerificationToken)
    private readonly verificationRepo: Repository<EmailVerificationToken>,
    private readonly notificationsService: NotificationsService,
  ) {}

  findByEmail(email: string) {
    return this.userRepo.findOne({ where: { email } });
  }

  findById(id: string) {
    return this.userRepo.findOne({ where: { id } });
  }

  create(dto: CreateUserDto) {
    return this.userRepo.save(this.userRepo.create(dto));
  }

  markEmailVerified(id: string) {
    return this.userRepo.update(id, { isEmailVerified: true });
  }

  deactivate(id: string) {
    return this.userRepo.update(id, { isActive: false });
  }
  updatePassword(id: string, passwordHash: string) {
    return this.userRepo.update(id, { passwordHash });
  }
  async sendVerificationEmail(userId: string, email: string) {
    const token = randomUUID();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await this.verificationRepo.save(
      this.verificationRepo.create({ userId, token, expiresAt }),
    );
    await this.notificationsService.sendEmailVerification(email, token);
  }

  async provisionInternalUser(dto: ProvisionInternalUserDto) {
    const existing = await this.findByEmail(dto.email);
    if (existing) {
      throw new ConflictException('An account with this email already exists');
    }

    if (dto.role === Role.ESO) {
      throw new BadRequestException(
        'Use self-registration for ESO applicant accounts',
      );
    }

    if (dto.role === Role.VALIDATOR && !dto.assignedState) {
      throw new BadRequestException(
        'assignedState is required when provisioning a validator',
      );
    }

    const passwordHash = await argon2.hash(dto.password);

    const user = await this.create({
      email: dto.email,
      passwordHash,
      fullName: dto.fullName,
      role: dto.role,
      assignedState: dto.assignedState,
    });
    await this.sendVerificationEmail(user.id, user.email);

    return user;

    // isEmailVerified stays false — they still verify their own email before first login,
    // isActive defaults true so they show up once verified
  }

  setMfaEnabled(id: string, enabled: boolean) {
    return this.userRepo.update(id, { mfaEnabled: enabled });
  }

  /**
   * Backs GET /internal/users. Was missing entirely — UsersController already called
   * this. Never returns ROLE_ESO applicants, matching the controller's documented
   * contract (see INTERNAL_ROLES above); a crafted ?role=ROLE_ESO is rejected rather
   * than silently ignored.
   */
  async listInternalUsers(role?: Role): Promise<User[]> {
    if (role && !INTERNAL_ROLES.includes(role)) {
      throw new BadRequestException(
        `role must be one of ${INTERNAL_ROLES.join(', ')}`,
      );
    }
    return this.userRepo.find({
      where: { role: In(role ? [role] : INTERNAL_ROLES) },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Backs PATCH /internal/users/:id/status. Was missing entirely — UsersController
   * already called this. Supersedes the one-directional `deactivate()` above (kept
   * as-is since it may still be referenced elsewhere) by allowing both suspend
   * (isActive: false) and reactivate (isActive: true) through the same call.
   */
  async setActive(id: string, isActive: boolean): Promise<User> {
    const user = await this.findById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    await this.userRepo.update(id, { isActive });
    // Return the entity instance (not a spread copy): a plain object has no
    // class-transformer metadata, so ClassSerializerInterceptor would not strip the
    // @Exclude()d passwordHash from the response.
    user.isActive = isActive;
    return user;
  }
}
