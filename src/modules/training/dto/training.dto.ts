import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { CohortStatus } from '@/common/enums/training.enum';

export class CreateCohortDto {
  @ApiProperty()
  @IsString()
  @MaxLength(150)
  name!: string;

  @ApiProperty({ description: 'Host institution (CoE) running the cohort' })
  @IsUUID()
  institutionId!: string;

  @ApiProperty()
  @IsUUID()
  courseId!: string;

  @ApiProperty({ example: '2026-10-05' })
  @IsDateString()
  startDate!: string;

  @ApiPropertyOptional({ example: '2026-12-18' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ description: '0 means no cap', default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  capacity?: number;
}

export class UpdateCohortStatusDto {
  @ApiProperty({ enum: CohortStatus })
  @IsEnum(CohortStatus)
  status!: CohortStatus;
}

export class EnrollBeneficiariesDto {
  @ApiProperty({ type: [String], description: 'Allocated Skills-pillar beneficiaries' })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @ArrayUnique()
  @IsUUID('all', { each: true })
  beneficiaryIds!: string[];
}

export class CompletionRecordDto {
  @ApiProperty()
  @IsUUID()
  beneficiaryId!: string;

  @ApiProperty()
  @IsBoolean()
  completed!: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  certified?: boolean;

  @ApiPropertyOptional({ minimum: 0, maximum: 100 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  attendanceRate?: number;
}

export class RecordCompletionsDto {
  @ApiProperty({ type: [CompletionRecordDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => CompletionRecordDto)
  records!: CompletionRecordDto[];
}
