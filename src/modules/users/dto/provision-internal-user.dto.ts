import { IsEmail, IsString, IsEnum, IsOptional, MinLength, IsIn, IsInt, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Role } from '@/common/enums/role.enum';

export class ProvisionInternalUserDto {
  @ApiProperty({ description: 'Internal user email', example: 'reviewer@idice.gov.ng' })
  @IsEmail()
  email!: string;

  @ApiProperty({ description: 'Initial password (min 8 characters)', example: 'ChangeMe@123' })
  @IsString()
  @MinLength(8)
  password!: string;

  @ApiProperty({ description: 'Full name', example: 'Jane Doe' })
  @IsString()
  fullName!: string;

  @ApiProperty({
    description: 'Internal role to provision',
    enum: [Role.ELIGIBILITY_REVIEWER, Role.SCORING_REVIEWER, Role.VALIDATOR, Role.SYSADMIN],
    example: Role.VALIDATOR,
  })
  @IsEnum(Role)
  role!: Role; 
  @ApiPropertyOptional({
    description: 'State this user is scoped to — required when role is ROLE_VALIDATOR',
    example: 'FCT',
  })
  @IsOptional()
  @IsString()
  assignedState?: string;

  @ApiPropertyOptional({
    description:
      'Scoring Reviewers only: 1 = Reviewer 1, 2 = Reviewer 2. Omit to take the first free slot. At most two scoring reviewers can be active.',
    enum: [1, 2],
  })
  @IsOptional()
  @IsInt()
  @IsIn([1, 2])
  scoringSlot?: number;

  @ApiPropertyOptional({
    description:
      'Off by default. When true, the email address and generated password are sent directly to the ' +
      'user via email, in addition to being shown once to the administrator provisioning the account.',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  sendCredentialsEmail?: boolean;
}