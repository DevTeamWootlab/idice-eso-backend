import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags, ApiOkResponse, ApiCreatedResponse } from '@nestjs/swagger';
import { Roles } from '@/common/decorators/roles.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Role } from '@/common/enums/role.enum';
import { JwtPayload } from '@/common/interfaces/jwt-payload.interface';
import { OutcomesService } from './outcomes.service';
import { RecordEmploymentOutcomeDto } from './dto/record-outcome.dto';
import { ListOutcomesDto } from './dto/list-outcomes.dto';
import { OutcomeCandidateListDto, EmploymentOutcomeDto } from './dto/outcome-responses.dto';

@ApiTags('Outcomes (SYSADMIN)')
@ApiBearerAuth()
@Controller('internal/outcomes')
@Roles(Role.SYSADMIN)
export class OutcomesController {
  constructor(private readonly outcomesService: OutcomesService) {}

  @ApiOperation({
    summary: 'List graduates and their employment outcome',
    description:
      'Requires role: ROLE_SYSADMIN. Beneficiaries who completed training, filterable by outcome ' +
      'state (NONE / UNVERIFIED / VERIFIED) and free text. These are the people an outcome can be recorded for.',
  })
  @ApiOkResponse({ type: OutcomeCandidateListDto })
  @Get()
  list(@Query() query: ListOutcomesDto) {
    return this.outcomesService.listCandidates(query);
  }

  @ApiOperation({
    summary: 'Record (or update / verify) a beneficiary’s employment outcome',
    description:
      'Requires role: ROLE_SYSADMIN. Only beneficiaries who completed training are eligible. ' +
      'Set verified=true once evidence is confirmed — only verified outcomes count towards the ' +
      'PCU job-placement rate.',
  })
  @ApiCreatedResponse({ type: EmploymentOutcomeDto })
  @Post()
  record(
    @Body() dto: RecordEmploymentOutcomeDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.outcomesService.record(dto, user.sub);
  }
}
