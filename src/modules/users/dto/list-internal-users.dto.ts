import { IsEnum, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Role } from '@/common/enums/role.enum';

export class ListInternalUsersDto {
  @ApiPropertyOptional({
    description: 'Filter to one internal role — omit to list all internal roles',
    enum: [Role.ELIGIBILITY_REVIEWER, Role.SCORING_REVIEWER, Role.VALIDATOR, Role.SYSADMIN],
  })
  @IsOptional()
  @IsEnum(Role)
  role?: Role;
}
