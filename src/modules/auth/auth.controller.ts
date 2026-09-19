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
import { ApiOkResponse, ApiCreatedResponse, ApiTags, ApiNoContentResponse, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { MeResponseDto } from './dto/me-response.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly mfaService: MfaService,
    private readonly usersService: UsersService,
  ) {}

  @ApiOperation({
    summary: 'Register an ESO applicant account',
    description:
      'Public. Creates the account and emails a verification link. The account cannot sign in until the email is verified.',
  })
  @Public()
  @ApiCreatedResponse({ description: 'User registered successfully', type: RegisterResponseDto })
  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @ApiOperation({
    summary: 'Verify an email address',
    description:
      'Public. Consumes the token from the emailed link (`token` query parameter). Single-use.',
  })
  @Public()
  @ApiOkResponse({ description: 'Email verified successfully', type: EmailVerificationResponseDto })
  @Get('verify-email')
  verifyEmail(@Query() dto: VerifyEmailDto) {
    return this.authService.verifyEmail(dto.token);
  }

  @ApiOperation({
    summary: 'Sign in with email and password',
    description:
      'Public. Returns access and refresh tokens; internal roles (and ESOs with two-factor on) instead receive `mfaRequired` or `mfaSetupRequired` with a short-lived token to complete sign-in.',
  })
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

  @ApiOperation({
    summary: 'Complete sign-in with a two-factor code',
    description:
      'Public. Accepts an authenticator code or an unused backup code together with the token returned by login.',
  })
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

  @ApiOperation({
    summary: 'Exchange a refresh token for new tokens',
    description:
      'Public. The refresh token in the body is rotated; the previous one stops working.',
  })
  @Public()
  @UseGuards(AuthGuard('jwt-refresh'))
  @ApiOkResponse({ description: 'Token refreshed successfully', type: LoginResponseDto })
  @Post('refresh')
  refresh(@Req() req: any) {
    return this.authService.refresh(req.user);
  }

  @ApiOperation({
    summary: 'Sign out this session',
    description:
      'Revokes the supplied refresh token.',
  })
  @ApiBearerAuth()
  @Post('logout')
  @ApiNoContentResponse({ description: 'User logged out successfully' })
  logout(@Body() dto: RefreshTokenDto) {
    return this.authService.logout(dto.refreshToken);
  }

  @ApiOperation({
    summary: 'Sign out on every device',
    description:
      'Revokes every refresh token for the signed-in user.',
  })
  @ApiBearerAuth()
  @Post('logout-all')
  @ApiNoContentResponse({ description: 'All user sessions logged out successfully' })
  logoutAll(@CurrentUser() user: JwtPayload) {
    return this.authService.logoutAll(user.sub);
  }

  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Current user profile',
    description:
      'Any authenticated role. The access token only carries id, email and role, so clients use this to show the ' +
      "user's name and (for validators) assigned state.",
  })
  @ApiOkResponse({ description: 'Profile of the signed-in user', type: MeResponseDto })
  @Get('me')
  me(@CurrentUser() user: JwtPayload) {
    return this.authService.getProfile(user.sub);
  }

  @ApiOperation({
    summary: 'List active sessions',
    description:
      'Devices (refresh tokens) currently signed in for the user, newest first.',
  })
  @ApiBearerAuth()
  @Get('sessions')
  @ApiOkResponse({ description: 'User sessions listed successfully', type: [SessionResponseDto] })
  listSessions(@CurrentUser() user: JwtPayload) {
    return this.authService.listSessions(user.sub);
  }

  @ApiOperation({
    summary: 'Request a password-reset email',
    description:
      'Public and rate-limited. Always responds the same way whether or not the email exists.',
  })
  @Public()
  @Throttle({ default: { limit: 3, ttl: 900000 } })
  @ApiOkResponse({ description: 'Password reset email sent successfully' })
  @Post('forgot-password')
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto.email);
  }

  @ApiOperation({
    summary: 'Reset the password with an emailed token',
    description:
      'Public. Single-use token from the reset email; revokes every session.',
  })
  @Public()
  @ApiOkResponse({ description: 'Password reset successfully' })
  @Post('reset-password')
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto.token, dto.newPassword);
  }

  @ApiOperation({
    summary: 'Change the password',
    description:
      'Requires the current password. Signs the user out everywhere.',
  })
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

  @ApiOperation({
    summary: 'Start authenticator enrolment',
    description:
      'Public (uses the setup token from login). Returns the secret and QR code URI to add to an authenticator app.',
  })
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

  @ApiOperation({
    summary: 'Confirm enrolment and receive backup codes',
    description:
      'Public (uses the setup token from login). Verifies the first code, enables two-factor and returns one-time backup codes.',
  })
  @Public()
  @ApiOkResponse({ description: 'MFA enabled successfully', type: MfaEnableResponseDto })
  @Post('mfa/enable')
  async enableMfa(@Body() dto: EnableMfaDto) {
    const userId = this.authService.verifySetupToken(dto.setupToken);
    return this.mfaService.enable(userId, dto.code);
  }

  // --- MFA management for an already-authenticated, already-enrolled user ---

  @ApiOperation({
    summary: 'Disable two-factor authentication',
    description:
      'Requires the account password. Internal roles are prompted to enrol again at next sign-in.',
  })
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

  @ApiOperation({
    summary: 'Generate new backup codes',
    description:
      'Replaces the stored codes; previous codes stop working. Only valid while two-factor is enabled.',
  })
  @ApiBearerAuth()
  @ApiOkResponse({ description: 'MFA backup codes regenerated successfully', type: MfaEnableResponseDto })
  @Post('mfa/backup-codes/regenerate')
  regenerateBackupCodes(@CurrentUser() user: JwtPayload) {
    return this.mfaService.regenerateBackupCodes(user.sub);
  }
}
