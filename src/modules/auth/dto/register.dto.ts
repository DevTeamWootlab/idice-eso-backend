import {
  IsEmail,
  IsString,
  MinLength,
  IsEnum,
  IsOptional,
} from 'class-validator';
import { Role } from '@/common/enums/role.enum';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({
    description: 'User email',
    example: 'user@example.com'
  })
  @IsEmail()
  email!: string;

  @ApiProperty({
    description: 'User password',
    example: 'password123'
  })
  @IsString()
  @MinLength(8)
  password!: string;

  @ApiProperty({
    description: 'User full name',
    example: 'John Doe'
  })
  @IsString()
  fullName!: string;

  // internal roles are provisioned by SYSADMIN via a separate endpoint,
  // not self-registration — this DTO is for ROLE_ESO applicants only
  @ApiProperty({
    description: 'User role',
    example: 'ROLE_ESO'
  })
  @IsOptional()
  @IsEnum(Role)
  role?: Role;
}
