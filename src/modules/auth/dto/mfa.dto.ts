import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';

export class MfaSetupTokenDto {
  @ApiProperty({
    description: 'MFA setup token',
    example: 'setup-token-123'
  })
  @IsString()
  setupToken!: string;
}

export class EnableMfaDto {
  @ApiProperty({
    description: 'MFA setup token',
    example: 'setup-token-123'
  })
  @IsString()
  setupToken!: string;

  @ApiProperty({
    description: '6-digit TOTP code',
    example: '123456'
  })
  @IsString()
  @Length(6, 6)
  code!: string;
}

export class VerifyMfaDto {
  @ApiProperty({
    description: 'MFA token',
    example: 'mfa-token-123'
  })
  @IsString()
  mfaToken!: string;

  @ApiProperty({
    description: '6-digit TOTP code or 8-character backup code',
    example: '123456'
  })
  @IsString()
  code!: string; // 6-digit TOTP, or an 8-char backup code
}

export class DisableMfaDto {
  @ApiProperty({
    description: 'User password',
    example: 'password123'
  })
  @IsString()
  password!: string;
}
