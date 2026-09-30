import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { OperatingState } from '@/common/enums/application.enum';
import { ADMIN_SEARCH_MAX_LENGTH } from '../admin-applications.query';

const blankToUndefined = ({ value }: { value: unknown }) =>
  typeof value === 'string' && value.trim() === '' ? undefined : value;

export const APPLICATION_EXPORT_FORMATS = ['csv', 'xlsx', 'pdf'] as const;
export type ApplicationExportFormat = (typeof APPLICATION_EXPORT_FORMATS)[number];

export class ExportAdminApplicationsDto {
  @ApiProperty({ enum: APPLICATION_EXPORT_FORMATS })
  @IsIn(APPLICATION_EXPORT_FORMATS as unknown as string[])
  format!: ApplicationExportFormat;

  @ApiPropertyOptional({ description: 'Organisation name or application reference' })
  @IsOptional()
  @Transform(blankToUndefined)
  @IsString()
  @MaxLength(ADMIN_SEARCH_MAX_LENGTH)
  search?: string;

  @ApiPropertyOptional({ description: 'One ApplicationStatus or a comma-separated list. Drafts are excluded by default.' })
  @IsOptional()
  @Transform(blankToUndefined)
  @IsString()
  @MaxLength(400)
  status?: string;

  @ApiPropertyOptional({ enum: OperatingState })
  @IsOptional()
  @Transform(blankToUndefined)
  @IsEnum(OperatingState)
  state?: OperatingState;
}
