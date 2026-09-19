import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export enum OutcomeFilter {
  NONE = 'NONE',
  UNVERIFIED = 'UNVERIFIED',
  VERIFIED = 'VERIFIED',
}

const blankToUndefined = ({ value }: { value: unknown }) =>
  typeof value === 'string' && value.trim() === '' ? undefined : value;

export class ListOutcomesDto {
  @ApiPropertyOptional({ description: 'Matches name or reference ID' })
  @IsOptional()
  @Transform(blankToUndefined)
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({ enum: OutcomeFilter })
  @IsOptional()
  @Transform(blankToUndefined)
  @IsEnum(OutcomeFilter)
  outcome?: OutcomeFilter;

  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
