import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsNumber,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { RUBRIC_CODES } from '../scoring-weights';

export class ScoringWeightInputDto {
  @ApiProperty({ enum: RUBRIC_CODES, example: 'LOCAL_PRESENCE' })
  @IsIn(RUBRIC_CODES)
  dimensionCode!: string;

  @ApiProperty({ minimum: 0, maximum: 100, example: 20 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  weightPercentage!: number;
}

export class UpdateScoringWeightsDto {
  @ApiProperty({
    type: [ScoringWeightInputDto],
    description: 'All six dimensions, totalling exactly 100%',
  })
  @IsArray()
  @ArrayMinSize(RUBRIC_CODES.length)
  @ArrayMaxSize(RUBRIC_CODES.length)
  @ValidateNested({ each: true })
  @Type(() => ScoringWeightInputDto)
  weights!: ScoringWeightInputDto[];
}

export class ScoringWeightDto {
  @ApiProperty({ enum: RUBRIC_CODES })
  dimensionCode!: string;

  @ApiProperty()
  label!: string;

  @ApiProperty({ example: 20 })
  weightPercentage!: number;
}

export class ScoringWeightsStateDto {
  @ApiProperty({ type: [ScoringWeightDto] })
  weights!: ScoringWeightDto[];

  @ApiProperty({
    description:
      'True once any score card has been submitted. Weights are then read-only so every application is scored on the same basis.',
  })
  locked!: boolean;

  @ApiProperty({ nullable: true, type: String })
  lockedReason!: string | null;
}
