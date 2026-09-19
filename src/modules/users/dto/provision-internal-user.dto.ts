import { IsEmail, IsString, IsEnum, IsOptional, MinLength, IsIn, IsInt } from 'class-validator';
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
  role!: Role; // ELIGIBILITY_REVIEWER, SCORING_REVIEWER, VALIDATOR, or SYSADMIN

  @ApiPropertyOptional({
    description: 'State this user is scoped to — required when role is ROLE_VALIDATOR',
    example: 'FCT',
  })
  @IsOptional()
  @IsString()
  assignedState?: string; // required in practice for VALIDATOR, enforced in service

  @ApiPropertyOptional({
    description:
      'Scoring Reviewers only: 1 = Reviewer 1, 2 = Reviewer 2. Omit to take the first free slot. At most two scoring reviewers can be active.',
    enum: [1, 2],
  })
  @IsOptional()
  @IsInt()
  @IsIn([1, 2])
  scoringSlot?: number;
}
