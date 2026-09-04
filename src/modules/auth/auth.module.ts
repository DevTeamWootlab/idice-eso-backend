import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { UsersModule } from '../users/users.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { RefreshToken } from './entities/refresh-token.entity';
import { PasswordResetToken } from './entities/password-reset-token.entity';
import { MfaSecret } from './entities/mfa-secret.entity';
import { EmailVerificationToken } from './entities/email-verification-token.entity';
import { LoginAttempt } from './entities/login-attempt.entity';
import { AuthService } from './auth.service';
import { MfaService } from './mfa.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { JwtRefreshStrategy } from './strategies/jwt-refresh.strategy';
import { AuthCleanupService } from './auth-cleanup.service';

@Module({
  imports: [
    UsersModule,
    NotificationsModule,
    PassportModule,
    TypeOrmModule.forFeature([
      RefreshToken,
      MfaSecret,
      EmailVerificationToken,
      LoginAttempt,
      PasswordResetToken,
    ]),

    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('jwt.accessSecret'),
        signOptions: {
          expiresIn: config.getOrThrow<string>('jwt.accessExpiresIn') as any,
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    MfaService,
    JwtStrategy,
    JwtRefreshStrategy,
    AuthCleanupService,
  ],
  exports: [AuthService],
})
export class AuthModule {}
