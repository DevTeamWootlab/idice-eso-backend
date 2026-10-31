import { ApiProperty } from '@nestjs/swagger';

const STATUSES = ['ON_TIME', 'LATE', 'DUE', 'OVERDUE'];

export class ReportInstitutionDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;
  @ApiProperty()
  name!: string;
  @ApiProperty()
  state!: string;
}

export class MonthlyReportDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;
  @ApiProperty({ example: '2026-10' })
  reportMonth!: string;
  @ApiProperty({ example: '2026-10-31', description: 'Last day of the reporting month' })
  dueDate!: string;
  @ApiProperty({ nullable: true, description: 'null for a nil report' })
  fileName!: string | null;
  @ApiProperty({ format: 'date-time' })
  submittedAt!: string;
  @ApiProperty({ enum: ['ON_TIME', 'LATE'] })
  status!: string;
  @ApiProperty({ description: 'true when the ESO filed a nil report' })
  isNil!: boolean;
  @ApiProperty({ nullable: true, description: 'Beneficiary rows in the file (0 for a nil report)' })
  beneficiaryCount!: number | null;
  @ApiProperty({ nullable: true })
  submittedByName!: string | null;
}

export class MyMonthlyReportsDto {
  @ApiProperty({ type: ReportInstitutionDto })
  institution!: ReportInstitutionDto;
  @ApiProperty({ example: '2026-10' })
  currentMonth!: string;
  @ApiProperty({ example: '2026-10-31' })
  currentDueDate!: string;
  @ApiProperty({ enum: STATUSES })
  currentStatus!: string;
  @ApiProperty({ example: '2026-09', description: 'First month this ESO is expected to report on' })
  earliestMonth!: string;
  @ApiProperty({ type: [MonthlyReportDto] })
  items!: MonthlyReportDto[];
}

export class AdminMonthlyReportRowDto {
  @ApiProperty({ format: 'uuid' })
  applicationId!: string;
  @ApiProperty()
  applicationRef!: string;
  @ApiProperty()
  esoName!: string;
  @ApiProperty({ type: ReportInstitutionDto })
  institution!: ReportInstitutionDto;
  @ApiProperty({ enum: STATUSES })
  status!: string;
  @ApiProperty({ type: MonthlyReportDto, nullable: true })
  report!: MonthlyReportDto | null;
}

export class AdminMonthlyReportSummaryDto {
  @ApiProperty()
  expected!: number;
  @ApiProperty()
  onTime!: number;
  @ApiProperty()
  late!: number;
  @ApiProperty()
  due!: number;
  @ApiProperty()
  overdue!: number;
}

export class AdminMonthlyReportsDto {
  @ApiProperty({ example: '2026-10' })
  month!: string;
  @ApiProperty({ example: '2026-10-31' })
  dueDate!: string;
  @ApiProperty({ type: AdminMonthlyReportSummaryDto })
  summary!: AdminMonthlyReportSummaryDto;
  @ApiProperty({ type: [AdminMonthlyReportRowDto] })
  items!: AdminMonthlyReportRowDto[];
}
