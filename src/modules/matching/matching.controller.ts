import { Controller, Get, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { MatchingService } from './matching.service';
import { Roles } from '@/common/decorators/roles.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Role } from '@/common/enums/role.enum';
import { JwtPayload } from '@/common/interfaces/jwt-payload.interface';

@ApiTags('Partner Match Engine (SYSADMIN)')
@ApiBearerAuth()
@Controller('internal/match-engine')
@Roles(Role.SYSADMIN)
export class MatchingController {
  constructor(private readonly matchingService: MatchingService) {}

  @ApiOperation({
    summary: 'Run the Partner Match Engine',
    description:
      'Requires role: ROLE_SYSADMIN. Gale-Shapley matching over the pool of ' +
      'VALIDATED_SHORTLISTED applications (composite score >= 70% and field-verified) ' +
      'against active host institutions, strictly enforcing state boundaries ' +
      '(E_loc = I_loc) and one ESO partner per institution. Returns the full current ' +
      'set of matches (equivalent to calling GET last-run immediately afterwards).',
  })
  @Post('run')
  run(@CurrentUser() user: JwtPayload) {
    return this.matchingService.runMatch(user.sub);
  }

  @ApiOperation({
    summary: 'Get the current set of matches',
    description: 'Requires role: ROLE_SYSADMIN.',
  })
  @Get('last-run')
  lastRun() {
    return this.matchingService.getLastRun();
  }
}
