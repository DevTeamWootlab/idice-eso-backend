import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
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
}
