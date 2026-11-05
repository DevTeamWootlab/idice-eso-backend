import { Body, Controller, Delete, Get, HttpCode, Param, ParseBoolPipe, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '@/common/decorators/roles.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Role } from '@/common/enums/role.enum';
import { JwtPayload } from '@/common/interfaces/jwt-payload.interface';
import { MatchingService } from './matching.service';
import {
  AssignableCandidateDto,
  CommitMatchesDto,
  CommitMatchesResultDto,
  ManualAssignDto,
  MatchDto,
  MatchOverviewDto,
  UnmatchedApplicationDto,
} from './dto/matching.dto';

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
      "Compatibility Index is calculated from the applications' own scores and sector focus. " +
      'Manual pairings staged as AWAITING_APPROVAL are preserved and their institutions and ESOs ' +
      'are excluded from the run. This only PROPOSES: nothing changes for any application until ' +
      'the proposals are approved with POST /internal/match-engine/commit. ' +
      'Returns the full current set of matches.',
  })
  @ApiCreatedResponse({ description: 'Full current set of matches, best MCI first.', type: [MatchDto] })
  @Post('run')
  run(@CurrentUser() user: JwtPayload) {
    return this.matchingService.runMatch(user.sub);
  }

  @ApiOperation({
    summary: 'Approve / commit proposed matches',
    description:
      'Requires role: ROLE_SYSADMIN. Approves the given matches (all GENERATED and AWAITING_APPROVAL ' +
      'matches when matchIds is omitted): each application moves to MATCHED, the match becomes ' +
      'ACCEPTED, and the ESO is notified. Matches that went stale since they were proposed or staged ' +
      'are skipped with a reason.',
  })
  @ApiCreatedResponse({
    description: 'Committed matches and any proposals skipped as stale, with reasons.',
    type: CommitMatchesResultDto,
  })
  @ApiBadRequestResponse({ description: 'There are no matches awaiting approval' })
  @Post('commit')
  commit(@Body() dto: CommitMatchesDto, @CurrentUser() user: JwtPayload) {
    return this.matchingService.commitMatches(user.sub, dto.matchIds);
  }

  @ApiOperation({
    summary: 'Validated applications that are not in the current set of matches, with the reason',
    description:
      'Requires role: ROLE_SYSADMIN. Every VALIDATED_SHORTLISTED application without a proposed, staged or approved match, ' +
      'with why: no Centre of Excellence selected, centre inactive, score below threshold, centre already taken, ' +
      'or ranked below the ESO proposed for the same centre.',
  })
  @ApiOkResponse({
    description: 'Unmatched validated applications, each with the reason it is unmatched.',
    type: [UnmatchedApplicationDto],
  })
  @Get('unmatched')
  unmatched() {
    return this.matchingService.getUnmatched();
  }

  @ApiOperation({
    summary: 'Get the current set of matches',
    description:
      'Requires role: ROLE_SYSADMIN. Proposed (GENERATED), staged manual (AWAITING_APPROVAL) and ' +
      'committed (ACCEPTED) matches, best MCI first. Each match carries its source (SYSTEM or MANUAL).',
  })
  @ApiOkResponse({ description: 'Current set of matches, best MCI first.', type: [MatchDto] })
  @Get('last-run')
  lastRun() {
    return this.matchingService.getLastRun();
  }

  @ApiOperation({
    summary: 'Every Host Institution with its pairing (or unassigned) and summary counts',
    description:
      'Requires role: ROLE_SYSADMIN. Lists all active Centres of Excellence, including those with no pairing, ' +
      'each with its suggested, staged or approved ESO. The summary carries the dashboard counters ' +
      '(paired, unassigned, awaiting approval, approved, manual overrides, cross-state).',
  })
  @ApiOkResponse({ type: MatchOverviewDto })
  @Get('overview')
  overview() {
    return this.matchingService.getOverview();
  }

  @ApiOperation({
    summary: 'Candidate ESOs for a Centre of Excellence (assign / override picker)',
    description:
      'Requires role: ROLE_SYSADMIN. Validated ESOs with a final score of 70% or more, ranked by MCI against the ' +
      'given institution. Same state only unless crossState=true. ESOs already in a suggested, staged or approved ' +
      'pairing are returned with pairedWith set and cannot be assigned until that pairing is overridden or withdrawn.',
  })
  @ApiParam({ name: 'institutionId', format: 'uuid', description: 'Host institution (Centre of Excellence) ID' })
  @ApiQuery({ name: 'crossState', required: false, type: Boolean, description: 'Include ESOs from every state' })
  @ApiOkResponse({ description: 'Candidates ranked by MCI, unpaired first.', type: [AssignableCandidateDto] })
  @ApiNotFoundResponse({ description: 'Institution not found' })
  @Get('institutions/:institutionId/candidates')
  candidates(
    @Param('institutionId', ParseUUIDPipe) institutionId: string,
    @Query('crossState', new ParseBoolPipe({ optional: true })) crossState?: boolean,
  ) {
    return this.matchingService.getAssignableCandidates(institutionId, crossState === true);
  }

  @ApiOperation({
    summary: 'Manually assign an ESO to a Centre of Excellence',
    description:
      'Requires role: ROLE_SYSADMIN. Overrides a suggested match or assigns an ESO to an unmatched centre. ' +
      'A reason is required and is recorded in the audit trail. ESOs from another state need allowCrossState=true; ' +
      'the cross-state exception and the administrator are logged. The pairing is staged as AWAITING_APPROVAL ' +
      'and only takes effect once approved with POST /internal/match-engine/commit.',
  })
  @ApiParam({ name: 'institutionId', format: 'uuid', description: 'Host institution (Centre of Excellence) ID' })
  @ApiCreatedResponse({ description: 'The staged manual match.', type: MatchDto })
  @ApiBadRequestResponse({
    description: 'Missing reason, the application is not eligible, or it is from another state without allowCrossState',
  })
  @ApiNotFoundResponse({ description: 'Institution or application not found' })
  @ApiConflictResponse({
    description: 'The ESO is already paired with another institution',
  })
  @Post('institutions/:institutionId/assign')
  assign(
    @Param('institutionId', ParseUUIDPipe) institutionId: string,
    @Body() dto: ManualAssignDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.matchingService.manualAssign(
      user.sub,
      institutionId,
      dto.applicationId,
      dto.reason,
      dto.allowCrossState === true,
    );
  }

  @ApiOperation({
    summary: 'Withdraw a staged manual pairing',
    description: 'Requires role: ROLE_SYSADMIN. Cancels a manual assignment that is still AWAITING_APPROVAL.',
  })
  @ApiParam({ name: 'matchId', format: 'uuid', description: 'Match ID' })
  @ApiNoContentResponse({ description: 'Manual assignment withdrawn. No body.' })
  @ApiNotFoundResponse({ description: 'Match not found' })
  @ApiBadRequestResponse({ description: 'Match is not a staged manual assignment' })
  @Delete(':matchId/manual')
  @HttpCode(204)
  async cancel(
    @Param('matchId', ParseUUIDPipe) matchId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<void> {
    await this.matchingService.cancelManualAssignment(user.sub, matchId);
  }
}
