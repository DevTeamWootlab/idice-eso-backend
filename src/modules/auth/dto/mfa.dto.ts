import { IsString, Length } from 'class-validator';

export class MfaSetupTokenDto {
  @IsString()
  setupToken!: string;
}

export class EnableMfaDto {
  @IsString()
  setupToken!: string;

  @IsString()
  @Length(6, 6)
  code!: string;
}

export class VerifyMfaDto {
  @IsString()
  mfaToken!: string;

  @IsString()
  code!: string; // 6-digit TOTP, or an 8-char backup code
}

export class DisableMfaDto {
  @IsString()
  password!: string;
}
