import { Controller, Get, Param, ParseUUIDPipe, Query, Res, StreamableFile } from '@nestjs/common';
import type { Response } from 'express';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '@/common/decorators/roles.decorator';
import { Role } from '@/common/enums/role.enum';
import { contentDisposition } from '@/common/utils/content-disposition';
import { MonthlyReportsService } from './monthly-reports.service';
import { ListMonthlyReportsDto } from './dto/list-monthly-reports.dto';
import { AdminMonthlyReportsDto } from './dto/monthly-report-responses.dto';

@ApiTags('Monthly reports (SYSADMIN)')
@ApiBearerAuth()
@Controller('internal/monthly-reports')
@Roles(Role.SYSADMIN)
export class InternalMonthlyReportsController {
  constructor(private readonly monthlyReportsService: MonthlyReportsService) {}

  @ApiOperation({
    summary: 'Monthly report status for every matched ESO',
    description:
      'Requires role: ROLE_SYSADMIN. Lists each matched ESO for the month with ON_TIME, LATE, DUE or OVERDUE. Reports are due on the last day of the month.',
  })
  @ApiOkResponse({ type: AdminMonthlyReportsDto })
  @Get()
  list(@Query() query: ListMonthlyReportsDto) {
    return this.monthlyReportsService.listForAdmin(query.month);
  }

  @ApiOperation({ summary: 'Download a submitted monthly report', description: 'Requires role: ROLE_SYSADMIN.' })
  @ApiOkResponse({ description: 'The file itself' })
  @Get(':id/download')
  async download(@Param('id', ParseUUIDPipe) id: string, @Res({ passthrough: true }) res: Response) {
    const file = await this.monthlyReportsService.download(id);
    res.set({
      'Content-Type': file.contentType,
      'Content-Disposition': contentDisposition(file.fileName, 'attachment'),
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'private, no-store',
    });
    return new StreamableFile(file.buffer);
  }
}
