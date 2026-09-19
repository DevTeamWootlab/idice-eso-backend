import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { OperatingState } from '@/common/enums/application.enum';
import {
  ADMIN_LIST_DEFAULT_LIMIT,
  ADMIN_LIST_MAX_LIMIT,
  ADMIN_SEARCH_MAX_LENGTH,
} from '../admin-applications.query';

const blankToUndefined = ({ value }: { value: unknown }) =>
  typeof value === 'string' && value.trim() === '' ? undefined : value;

export class ListAdminApplicationsDto {
  @ApiPropertyOptional({
    description:
      'Case-insensitive match against the organisation legal name or application code',
  })
  @IsOptional()
  @Transform(blankToUndefined)
  @IsString()
  @MaxLength(ADMIN_SEARCH_MAX_LENGTH)
  search?: string;

  @ApiPropertyOptional({
    description:
      'One ApplicationStatus or a comma-separated list. When omitted, DRAFT applications are excluded.',
    example: 'SHORTLISTED,VALIDATED_SHORTLISTED',
  })
  @IsOptional()
  @Transform(blankToUndefined)
  @IsString()
  @MaxLength(400)
  status?: string;

  @ApiPropertyOptional({
    description: 'Only applications that list this state in statesOfOperation',
    enum: OperatingState,
  })
  @IsOptional()
  @Transform(blankToUndefined)
  @IsEnum(OperatingState)
  state?: OperatingState;

  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({
    minimum: 1,
    maximum: ADMIN_LIST_MAX_LIMIT,
    default: ADMIN_LIST_DEFAULT_LIMIT,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(ADMIN_LIST_MAX_LIMIT)
  limit?: number;
}
