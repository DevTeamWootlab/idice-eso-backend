import {
  IsEmail,
  IsString,
  MinLength,
  IsEnum,
  IsOptional,
} from 'class-validator';
import { Role } from '@/common/enums/role.enum';

export class RegisterDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsString()
  fullName!: string;

  // internal roles are provisioned by SYSADMIN via a separate endpoint,
  // not self-registration — this DTO is for ROLE_ESO applicants only
  @IsOptional()
  @IsEnum(Role)
  role?: Role;
}
