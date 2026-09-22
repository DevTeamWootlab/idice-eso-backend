import { IsEmail, IsString, IsEnum, IsOptional } from 'class-validator';
import { Role } from '@/common/enums/role.enum';

export class CreateUserDto {
  @IsEmail()
  email!: string;

  @IsString()
  passwordHash!: string;

  @IsString()
  fullName!: string;

  @IsEnum(Role)
  role!: Role;

  @IsOptional()
  @IsString()
  assignedState?: string; 

  @IsOptional()
  scoringSlot?: number | null; 
}