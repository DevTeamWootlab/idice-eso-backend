import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, Matches } from 'class-validator';
import { REPORT_MONTH_PATTERN } from '../reporting-period';

export class ListMonthlyReportsDto {
  @ApiPropertyOptional({ example: '2026-10', description: 'Reporting month (YYYY-MM). Defaults to the current month.' })
  @IsOptional()
  @Matches(REPORT_MONTH_PATTERN, { message: 'month must be in the format YYYY-MM' })
  month?: string;
}
