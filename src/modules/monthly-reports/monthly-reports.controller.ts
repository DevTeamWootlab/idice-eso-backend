import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, Res, StreamableFile } from '@nestjs/common';
import type { Response } from 'express';
import { contentDisposition } from '@/common/utils/content-disposition';
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '@/common/decorators/roles.decorator';
import { Role } from '@/common/enums/role.enum';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { JwtPayload } from '@/common/interfaces/jwt-payload.interface';
import { MonthlyReportsService } from './monthly-reports.service';
import { SubmitMonthlyReportDto } from './dto/submit-monthly-report.dto';
import { MonthlyReportDto, MyMonthlyReportsDto } from './dto/monthly-report-responses.dto';

@ApiTags('Monthly reports (ESO)')
@ApiBearerAuth()
@Controller('monthly-reports')
@Roles(Role.ESO)
export class MonthlyReportsController {
  constructor(private readonly monthlyReportsService: MonthlyReportsService) {}

  @ApiOperation({
    summary: 'My monthly reports and the current deadline',
    description:
      'Requires role: ROLE_ESO with a matched application. Each report is due on the last day of the month it covers (Nigeria time).',
  })
  @ApiOkResponse({ type: MyMonthlyReportsDto })
  @Get('mine')
  mine(@CurrentUser() user: JwtPayload) {
    return this.monthlyReportsService.getMine(user.sub);
  }

  @ApiOperation({
    summary: 'Submit or replace the report for a month',
    description:
      'Requires role: ROLE_ESO with a matched application. Upload the file to Cloudinary first and send its URL. Submitting again for the same month replaces the earlier file.',
  })
  @ApiCreatedResponse({ type: MonthlyReportDto })
  @Post()
  @HttpCode(HttpStatus.CREATED)
  submit(@CurrentUser() user: JwtPayload, @Body() dto: SubmitMonthlyReportDto) {
    return this.monthlyReportsService.submit(user.sub, dto);
  }

  @ApiOperation({
    summary: 'Download one of my submitted monthly reports',
    description: 'Requires role: ROLE_ESO (owner only). Nil reports have no file and return 404.',
  })
  @ApiOkResponse({ description: 'The file itself' })
  @Get(':id/download')
  async download(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const file = await this.monthlyReportsService.downloadMine(user.sub, id);
    res.set({
      'Content-Type': file.contentType,
      'Content-Disposition': contentDisposition(file.fileName, 'attachment'),
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'private, no-store',
    });
    return new StreamableFile(file.buffer);
  }
}
