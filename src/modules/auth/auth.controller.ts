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
import {
  LoginResponseDto,
  RegisterResponseDto,
  EmailVerificationResponseDto,
  SessionResponseDto,
  MfaSetupResponseDto,
  MfaEnableResponseDto,
} from './dto/response.dto';
import { Public } from '@/common/decorators/public.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { JwtPayload } from '@/common/interfaces/jwt-payload.interface';
import { ApiOkResponse, ApiCreatedResponse, ApiTags, ApiNoContentResponse, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly mfaService: MfaService,
    private readonly usersService: UsersService,
  ) {}

  @Public()
  @ApiCreatedResponse({ description: 'User registered successfully', type: RegisterResponseDto })
  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Public()
  @ApiOkResponse({ description: 'Email verified successfully', type: EmailVerificationResponseDto })
  @Get('verify-email')
  verifyEmail(@Query() dto: VerifyEmailDto) {
    return this.authService.verifyEmail(dto.token);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOkResponse({ description: 'User logged in successfully', type: LoginResponseDto })
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
  @ApiOkResponse({ description: 'User Verified', type: LoginResponseDto })
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
  @ApiOkResponse({ description: 'Token refreshed successfully', type: LoginResponseDto })
  @Post('refresh')
  refresh(@Req() req: any) {
    return this.authService.refresh(req.user);
  }

  @ApiBearerAuth()
  @Post('logout')
  @ApiNoContentResponse({ description: 'User logged out successfully' })
  logout(@Body() dto: RefreshTokenDto) {
    return this.authService.logout(dto.refreshToken);
  }

  @ApiBearerAuth()
  @Post('logout-all')
  @ApiNoContentResponse({ description: 'All user sessions logged out successfully' })
  logoutAll(@CurrentUser() user: JwtPayload) {
    return this.authService.logoutAll(user.sub);
  }

  @ApiBearerAuth()
  @Get('sessions')
  @ApiOkResponse({ description: 'User sessions listed successfully', type: [SessionResponseDto] })
  listSessions(@CurrentUser() user: JwtPayload) {
    return this.authService.listSessions(user.sub);
  }

  @Public()
  @Throttle({ default: { limit: 3, ttl: 900000 } })
  @ApiOkResponse({ description: 'Password reset email sent successfully' })
  @Post('forgot-password')
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto.email);
  }

  @Public()
  @ApiOkResponse({ description: 'Password reset successfully' })
  @Post('reset-password')
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto.token, dto.newPassword);
  }

  @ApiBearerAuth()
  @ApiOkResponse({ description: 'Password changed successfully' })
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
  @ApiOkResponse({ description: 'MFA setup initiated successfully', type: MfaSetupResponseDto })
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
  @ApiOkResponse({ description: 'MFA enabled successfully', type: MfaEnableResponseDto })
  @Post('mfa/enable')
  async enableMfa(@Body() dto: EnableMfaDto) {
    const userId = this.authService.verifySetupToken(dto.setupToken);
    return this.mfaService.enable(userId, dto.code);
  }

  // --- MFA management for an already-authenticated, already-enrolled user ---

  @ApiBearerAuth()
  @ApiOkResponse({ description: 'MFA disabled successfully' })
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

  @ApiBearerAuth()
  @ApiOkResponse({ description: 'MFA backup codes regenerated successfully', type: MfaEnableResponseDto })
  @Post('mfa/backup-codes/regenerate')
  regenerateBackupCodes(@CurrentUser() user: JwtPayload) {
    return this.mfaService.regenerateBackupCodes(user.sub);
  }
}
