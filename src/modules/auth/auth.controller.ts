import {
  Body,
  Controller,
  Get,
  Headers,
  Ip,
  Post,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { MfaService } from './mfa.service';
import { UsersService } from '../users/users.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import {
  MfaSetupTokenDto,
  EnableMfaDto,
  VerifyMfaDto,
  DisableMfaDto,
} from './dto/mfa.dto';
import {
  ForgotPasswordDto,
  ResetPasswordDto,
  ChangePasswordDto,
} from './dto/password.dto';
import { Public } from '@/common/decorators/public.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { JwtPayload } from '@/common/interfaces/jwt-payload.interface';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly mfaService: MfaService,
    private readonly usersService: UsersService,
  ) {}

  @Public()
  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Public()
  @Get('verify-email')
  verifyEmail(@Query() dto: VerifyEmailDto) {
    return this.authService.verifyEmail(dto.token);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('login')
  login(
    @Body() dto: LoginDto,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string,
  ) {
    return this.authService.login(dto, { ipAddress: ip, userAgent });
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('mfa/verify')
  verifyMfa(
    @Body() dto: VerifyMfaDto,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string,
  ) {
    return this.authService.verifyMfaAndLogin(dto.mfaToken, dto.code, {
      ipAddress: ip,
      userAgent,
    });
  }

  @Public()
  @UseGuards(AuthGuard('jwt-refresh'))
  @Post('refresh')
  refresh(@Req() req: any) {
    return this.authService.refresh(req.user);
  }

  @Post('logout')
  logout(@Body() dto: RefreshTokenDto) {
    return this.authService.logout(dto.refreshToken);
  }

  @Post('logout-all')
  logoutAll(@CurrentUser() user: JwtPayload) {
    return this.authService.logoutAll(user.sub);
  }

  @Get('sessions')
  listSessions(@CurrentUser() user: JwtPayload) {
    return this.authService.listSessions(user.sub);
  }

  @Public()
  @Throttle({ default: { limit: 3, ttl: 900000 } })
  @Post('forgot-password')
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto.email);
  }

  @Public()
  @Post('reset-password')
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto.token, dto.newPassword);
  }

  @Post('change-password')
  changePassword(
    @CurrentUser() user: JwtPayload,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.authService.changePassword(
      user.sub,
      dto.currentPassword,
      dto.newPassword,
    );
  }

  // --- MFA setup — called with the setupToken returned from a login that required enrolment ---

  @Public()
  @Post('mfa/setup')
  async setupMfa(@Body() dto: MfaSetupTokenDto) {
    const userId = this.authService.verifySetupToken(dto.setupToken);
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    return this.mfaService.generateSetup(userId, user.email);
  }

  @Public()
  @Post('mfa/enable')
  async enableMfa(@Body() dto: EnableMfaDto) {
    const userId = this.authService.verifySetupToken(dto.setupToken);
    return this.mfaService.enable(userId, dto.code);
  }

  // --- MFA management for an already-authenticated, already-enrolled user ---

  @Post('mfa/disable')
  async disableMfa(
    @CurrentUser() user: JwtPayload,
    @Body() dto: DisableMfaDto,
  ) {
    const passwordValid = await this.authService.verifyPassword(
      user.sub,
      dto.password,
    );
    if (!passwordValid) {
      throw new UnauthorizedException('Incorrect password');
    }
    await this.mfaService.disable(user.sub);
    return { message: 'MFA has been disabled for your account' };
  }

  @Post('mfa/backup-codes/regenerate')
  regenerateBackupCodes(@CurrentUser() user: JwtPayload) {
    return this.mfaService.regenerateBackupCodes(user.sub);
  }
}
