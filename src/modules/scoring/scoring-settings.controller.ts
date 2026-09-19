import { Body, Controller, Get, Put } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiBadRequestResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '@/common/decorators/roles.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Role } from '@/common/enums/role.enum';
import { JwtPayload } from '@/common/interfaces/jwt-payload.interface';
import { ScoringService } from './scoring.service';
import {
  ScoringWeightsStateDto,
  UpdateScoringWeightsDto,
} from './dto/scoring-weights.dto';

@ApiTags('Scoring settings')
@ApiBearerAuth()
@Controller('internal/settings/scoring-weights')
export class ScoringSettingsController {
  constructor(private readonly scoringService: ScoringService) {}

  @ApiOperation({
    summary: 'Current scoring weights',
    description:
      'Requires an internal role (eligibility reviewer, scoring reviewer, validator or SYSADMIN). ' +
      'Also reports whether the weights are locked.',
  })
  @ApiOkResponse({ type: ScoringWeightsStateDto })
  @Roles(
    Role.ELIGIBILITY_REVIEWER,
    Role.SCORING_REVIEWER,
    Role.VALIDATOR,
    Role.SYSADMIN,
  )
  @Get()
  get() {
    return this.scoringService.getWeightsState();
  }

  @ApiOperation({
    summary: 'Update scoring weights',
    description:
      'Requires role: ROLE_SYSADMIN. All six dimensions must be supplied and total exactly 100%. ' +
      'Rejected with 409 once any score card has been submitted.',
  })
  @ApiOkResponse({ type: ScoringWeightsStateDto })
  @ApiBadRequestResponse({ description: 'Unknown/missing dimension or weights do not total 100%' })
  @ApiConflictResponse({ description: 'Scoring has started; the weights are locked' })
  @Roles(Role.SYSADMIN)
  @Put()
  update(@Body() dto: UpdateScoringWeightsDto, @CurrentUser() user: JwtPayload) {
    return this.scoringService.updateWeights(dto, user);
  }
}
