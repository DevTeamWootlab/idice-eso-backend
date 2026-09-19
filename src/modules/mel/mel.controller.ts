import { Controller, Get, Param, ParseUUIDPipe, Query, Res, StreamableFile } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiProduces, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { Roles } from '@/common/decorators/roles.decorator';
import { Role } from '@/common/enums/role.enum';
import { MelService } from './mel.service';
import { PcuCoeDetailDto, PcuMetricsDto } from './dto/pcu-metrics.dto';
import { PcuExportQueryDto, PcuQueryDto } from './dto/pcu-query.dto';
import { reportToCsv, reportToPdf, reportToXlsx } from './pcu-report';

const MIME = {
  csv: 'text/csv; charset=utf-8',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pdf: 'application/pdf',
} as const;

@ApiTags('PCU M&E (SYSADMIN)')
@ApiBearerAuth()
@Controller('internal/pcu')
@Roles(Role.SYSADMIN)
export class MelController {
  constructor(private readonly melService: MelService) {}

  @ApiOperation({
    summary: 'Programme KPIs for the PCU M&E dashboard',
    description:
      'Requires role: ROLE_SYSADMIN. Live aggregation, optionally filtered by state, Centre of ' +
      'Excellence, cohort, regulator (NUC / NBTE) and time period.',
  })
  @ApiOkResponse({ type: PcuMetricsDto })
  @Get('metrics')
  metrics(@Query() query: PcuQueryDto) {
    return this.melService.getPcuMetrics(query);
  }

  @ApiOperation({
    summary: 'Drill down into one Centre of Excellence',
    description:
      'Requires role: ROLE_SYSADMIN. The CoE\'s KPIs, capacity utilisation, pillar and gender mix, and every cohort with its members and completions. Accepts the period and cohort filters.',
  })
  @ApiOkResponse({ type: PcuCoeDetailDto })
  @Get('coe/:institutionId')
  coe(@Param('institutionId', ParseUUIDPipe) institutionId: string, @Query() query: PcuQueryDto) {
    return this.melService.getCoeDetail(institutionId, query);
  }

  @ApiOperation({
    summary: 'Download a statutory report (CSV, Excel or PDF)',
    description:
      'Requires role: ROLE_SYSADMIN. report=pcu covers the whole programme; report=nuc only ' +
      'universities; report=nbte only polytechnics. The applied filters are printed in the file. ' +
      'Responds with the file itself, not the usual JSON envelope.',
  })
  @ApiProduces(MIME.csv, MIME.xlsx, MIME.pdf)
  @ApiOkResponse({ description: 'The report file (binary).' })
  @Get('export')
  async export(@Query() query: PcuExportQueryDto, @Res({ passthrough: true }) res: Response) {
    const { format, report = 'pcu', ...filters } = query;
    const model = await this.melService.buildReport(report, filters);
    const body =
      format === 'csv'
        ? Buffer.from(reportToCsv(model), 'utf8')
        : format === 'xlsx'
          ? reportToXlsx(model)
          : reportToPdf(model);
    res.set({
      'Content-Type': MIME[format],
      'Content-Disposition': `attachment; filename="${report}-report-${model.generatedAt.slice(0, 10)}.${format}"`,
    });
    return new StreamableFile(body);
  }
}
