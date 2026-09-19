import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class PcuQueryDto {
  @ApiPropertyOptional({ example: 'Kwara', description: 'Only Centres of Excellence in this state' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  state?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Only this Centre of Excellence' })
  @IsOptional()
  @IsUUID()
  institutionId?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Only youth enrolled in this cohort' })
  @IsOptional()
  @IsUUID()
  cohortId?: string;

  @ApiPropertyOptional({
    example: '2026-01-01',
    description: 'Start of the period (inclusive). Enrolment counts by allocation date; completions and placements by their own date.',
  })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ example: '2026-09-30', description: 'End of the period (inclusive)' })
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiPropertyOptional({ enum: ['NUC', 'NBTE'], description: 'Only universities (NUC) or polytechnics (NBTE)' })
  @IsOptional()
  @IsIn(['NUC', 'NBTE'])
  regulator?: 'NUC' | 'NBTE';
}

export class PcuExportQueryDto extends PcuQueryDto {
  @ApiProperty({ enum: ['csv', 'xlsx', 'pdf'] })
  @IsIn(['csv', 'xlsx', 'pdf'])
  format!: 'csv' | 'xlsx' | 'pdf';

  @ApiPropertyOptional({
    enum: ['pcu', 'nuc', 'nbte'],
    default: 'pcu',
    description: 'pcu = whole programme; nuc = universities only; nbte = polytechnics only',
  })
  @IsOptional()
  @IsIn(['pcu', 'nuc', 'nbte'])
  report?: 'pcu' | 'nuc' | 'nbte';
}
