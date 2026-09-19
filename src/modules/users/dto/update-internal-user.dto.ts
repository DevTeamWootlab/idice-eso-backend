import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { INTERNAL_ROLE_VALUES } from '../user-rules';

export class UpdateInternalUserDto {
  @ApiPropertyOptional({ example: 'Jane Doe' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  fullName?: string;

  @ApiPropertyOptional({ enum: INTERNAL_ROLE_VALUES, description: 'Reassign the account to another internal role' })
  @IsOptional()
  @IsIn(INTERNAL_ROLE_VALUES)
  role?: string;

  @ApiPropertyOptional({ example: 'KWARA', description: 'Validators only — the state they are scoped to' })
  @IsOptional()
  @IsString()
  assignedState?: string;

  @ApiPropertyOptional({ enum: [1, 2], description: 'Scoring Reviewers only — Reviewer 1 or Reviewer 2' })
  @IsOptional()
  @IsInt()
  @IsIn([1, 2])
  scoringSlot?: number;
}
