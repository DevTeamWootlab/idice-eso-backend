import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';
import { REPORT_MONTH_PATTERN } from '../reporting-period';

export class SubmitMonthlyReportDto {
  @ApiProperty({ example: '2026-10', description: 'The month this report covers (YYYY-MM)' })
  @Matches(REPORT_MONTH_PATTERN, { message: 'reportMonth must be a month in the format YYYY-MM' })
  reportMonth!: string;

  @ApiProperty({
    example: 'https://res.cloudinary.com/demo/raw/upload/v1/eso-monthly-reports/report_1/october.xlsx',
    description: 'Cloudinary secure URL of the uploaded report file',
  })
  @Matches(/^https:\/\/res\.cloudinary\.com\/\S{1,480}$/, {
    message: 'Upload the report file before submitting.',
  })
  fileUrl!: string;

  @ApiProperty({ example: 'october-beneficiary-report.xlsx' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  fileName!: string;
}
