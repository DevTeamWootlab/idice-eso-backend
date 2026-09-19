import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { EmploymentOutcomeType } from '@/common/enums/outcomes.enum';

export class RecordEmploymentOutcomeDto {
  @ApiProperty()
  @IsUUID()
  beneficiaryId!: string;

  @ApiProperty({ enum: EmploymentOutcomeType })
  @IsEnum(EmploymentOutcomeType)
  outcomeType!: EmploymentOutcomeType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  employerOrVentureName?: string;

  @ApiPropertyOptional({ example: '2026-11-20' })
  @IsOptional()
  @IsDateString()
  achievedOn?: string;

  @ApiPropertyOptional({
    description: 'Only verified outcomes count towards the PCU job-placement rate',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  verified?: boolean;
}
