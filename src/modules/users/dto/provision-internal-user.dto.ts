import {
  IsEmail,
  IsString,
  IsEnum,
  IsOptional,
  MinLength,
} from 'class-validator';
import { Role } from '@/common/enums/role.enum';

export class ProvisionInternalUserDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsString()
  fullName!: string;

  @IsEnum(Role)
  role!: Role; // ELIGIBILITY_REVIEWER, SCORING_REVIEWER, VALIDATOR, or SYSADMIN

  @IsOptional()
  @IsString()
  assignedState?: string; // required in practice for VALIDATOR, enforced in service
}
