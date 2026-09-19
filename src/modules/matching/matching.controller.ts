import { Body, Controller, Get, Post } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '@/common/decorators/roles.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Role } from '@/common/enums/role.enum';
import { JwtPayload } from '@/common/interfaces/jwt-payload.interface';
import { MatchingService } from './matching.service';
import { CommitMatchesDto, CommitMatchesResultDto, MatchDto } from './dto/matching.dto';

@ApiTags('Partner Match Engine (SYSADMIN)')
@ApiBearerAuth()
@Controller('internal/match-engine')
@Roles(Role.SYSADMIN)
export class MatchingController {
  constructor(private readonly matchingService: MatchingService) {}

  @ApiOperation({
    summary: 'Run the Partner Match Engine (propose matches)',
    description:
      'Requires role: ROLE_SYSADMIN. Proposes the best ESO partner for every open host institution ' +
      'from VALIDATED_SHORTLISTED applications (composite score >= 70%), strictly within each ' +
      "institution's state (E_loc = I_loc) with one ESO partner per institution. The Match " +
      'Compatibility Index is calculated from the applications\' own scores and sector focus. ' +
      'This only PROPOSES: nothing changes for any application until the proposals are approved ' +
      'with POST /internal/match-engine/commit. Returns the full current set of matches.',
  })
  @ApiCreatedResponse({ type: [MatchDto] })
  @Post('run')
  run(@CurrentUser() user: JwtPayload) {
    return this.matchingService.runMatch(user.sub);
  }

  @ApiOperation({
    summary: 'Approve / commit proposed matches',
    description:
      'Requires role: ROLE_SYSADMIN. Approves the given proposed matches (all of them when matchIds ' +
      'is omitted): each application moves to MATCHED, the match becomes ACCEPTED, and the ESO is ' +
      'notified. Proposals that went stale since they were generated are skipped with a reason.',
  })
  @ApiCreatedResponse({ type: CommitMatchesResultDto })
  @ApiBadRequestResponse({ description: 'There are no proposed matches to approve' })
  @Post('commit')
  commit(@Body() dto: CommitMatchesDto, @CurrentUser() user: JwtPayload) {
    return this.matchingService.commitMatches(user.sub, dto.matchIds);
  }

  @ApiOperation({
    summary: 'Get the current set of matches',
    description:
      'Requires role: ROLE_SYSADMIN. Proposed (GENERATED) and committed (ACCEPTED) matches, best MCI first.',
  })
  @ApiOkResponse({ type: [MatchDto] })
  @Get('last-run')
  lastRun() {
    return this.matchingService.getLastRun();
  }
}
