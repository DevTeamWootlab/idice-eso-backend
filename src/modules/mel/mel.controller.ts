import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags, ApiOkResponse } from '@nestjs/swagger';
import { Roles } from '@/common/decorators/roles.decorator';
import { Role } from '@/common/enums/role.enum';
import { MelService } from './mel.service';
import { PcuMetricsDto } from './dto/pcu-metrics.dto';

@ApiTags('PCU M&E (SYSADMIN)')
@ApiBearerAuth()
@Controller('internal/pcu')
@Roles(Role.SYSADMIN)
export class MelController {
  constructor(private readonly melService: MelService) {}

  @ApiOperation({
    summary: 'Programme-wide M&E KPIs',
    description:
      'Requires role: ROLE_SYSADMIN. Live aggregation across all Centres of Excellence: ' +
      'youth enrolled (ALLOCATED beneficiaries), female participation, startups incubated, ' +
      'verified job placement, NEET/PWD inclusion, skill-tier completions and a per-CoE ' +
      'breakdown, each against its programme target. Percentages are null while their ' +
      'denominator is zero.',
  })
  @ApiOkResponse({ type: PcuMetricsDto })
  @Get('metrics')
  metrics() {
    return this.melService.getPcuMetrics();
  }
}
