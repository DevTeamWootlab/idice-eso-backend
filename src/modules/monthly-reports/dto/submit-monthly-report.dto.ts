import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString, Matches, Max, MaxLength, Min, ValidateIf } from 'class-validator';
import { REPORT_MONTH_PATTERN } from '../reporting-period';

export class SubmitMonthlyReportDto {
  @ApiProperty({ example: '2026-10', description: 'The month this report covers (YYYY-MM)' })
  @Matches(REPORT_MONTH_PATTERN, { message: 'reportMonth must be a month in the format YYYY-MM' })
  reportMonth!: string;

  @ApiPropertyOptional({
    example: false,
    description: 'true files a nil report (no beneficiaries allocated or active this month) with no file attached',
  })
  @IsOptional()
  @IsBoolean()
  isNil?: boolean;

  @ApiPropertyOptional({
    example: 'https://res.cloudinary.com/demo/raw/upload/v1/eso-monthly-reports/report_1/october.csv',
    description: 'Cloudinary secure URL of the uploaded report file. Required unless isNil is true.',
  })
  @ValidateIf((dto: SubmitMonthlyReportDto) => !dto.isNil)
  @Matches(/^https:\/\/res\.cloudinary\.com\/\S{1,480}$/, {
    message: 'Upload the report file before submitting.',
  })
  fileUrl?: string;

  @ApiPropertyOptional({ example: 'october-beneficiary-report.csv', description: 'Required unless isNil is true.' })
  @ValidateIf((dto: SubmitMonthlyReportDto) => !dto.isNil)
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  fileName?: string;

  @ApiPropertyOptional({ example: 34, description: 'Number of beneficiary rows in the uploaded file' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100000)
  beneficiaryCount?: number;
}
