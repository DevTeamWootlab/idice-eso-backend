import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, IsDate } from 'class-validator';

export class RegisterResponseDto {
  @ApiProperty({ description: 'User ID' })
  id!: string;

  @ApiProperty({ description: 'User email' })
  @IsEmail()
  email!: string;

  @ApiProperty({ description: 'Registration message' })
  @IsString()
  message!: string;
}

export class EmailVerificationResponseDto {
  @ApiProperty({ description: 'Verification message' })
  @IsString()
  message!: string;
}

export class LoginResponseDto {
  @ApiProperty({ description: 'Access token' })
  @IsString()
  accessToken!: string;

  @ApiProperty({ description: 'Refresh token' })
  @IsString()
  refreshToken!: string;
}

export class SessionResponseDto {
  @ApiProperty({ description: 'Session ID' })
  @IsString()
  sessionId!: string;

  @ApiProperty({ description: 'User Agent' })
  @IsString()
  userAgent!: string;

  @ApiProperty({ description: 'IP Address' })
  @IsString()
  ipAddress!: string;

  @ApiProperty({ description: 'Creation Date' })
  @IsDate()
  createdAt!: Date;

  @ApiProperty({ description: 'Expiration Date' })
  @IsDate()
  expiresAt!: Date;
}

export class MfaSetupResponseDto {
  @ApiProperty({ description: 'QR Code Data URL' })
  @IsString()
  qrCodeDataUrl!: string;

  @ApiProperty({ description: 'Manual Entry Key' })
  @IsString()
  manualEntryKey!: string;
}

export class MfaEnableResponseDto {
  @ApiProperty({ description: 'Backup Codes' })
  @IsString({ each: true })
  backupCodes!: string[];
}