import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post } from '@nestjs/common';
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
  UnmatchedApplicationDto,
} from './dto/matching.dto';

@ApiTags('Partner Match Engine (SYSADMIN)')
@ApiBearerAuth()
@Controller('internal/match-engine')
@Roles(Role.SYSADMIN)
export class MatchingController {
  constructor(private readonly matchingService: MatchingService) { }

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
  @ApiBadRequestResponse({ description: 'There are no proposed matches to approve' })
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

  /** Swap picker: eligible validated-but-unmatched ESOs for one CoE, ranked by MCI. */
  @ApiOperation({
    summary: 'Eligible candidates for a Centre of Excellence (swap picker)',
    description:
      'Requires role: ROLE_SYSADMIN. Eligible validated-but-unmatched ESOs for the given institution ' +
      '(same state, final score >= 70%, not already staged), ranked by MCI against that institution.',
  })
  @ApiParam({ name: 'institutionId', format: 'uuid', description: 'Host institution (Centre of Excellence) ID' })
  @ApiOkResponse({ description: 'Candidates ranked by MCI, best first.', type: [AssignableCandidateDto] })
  @ApiNotFoundResponse({ description: 'Institution not found' })
  @Get('institutions/:institutionId/candidates')
  candidates(@Param('institutionId', ParseUUIDPipe) institutionId: string) {
    return this.matchingService.getAssignableCandidates(institutionId);
  }

  /** Override a suggestion or assign to an unmatched CoE. Stages as AWAITING_APPROVAL. */
  @ApiOperation({
    summary: 'Manually assign an ESO to a Centre of Excellence',
    description:
      'Requires role: ROLE_SYSADMIN. Overrides a suggested match or assigns an ESO to an unmatched centre. ' +
      'A reason is required and is recorded in the audit trail. The pairing is staged as AWAITING_APPROVAL ' +
      'and only takes effect once approved with POST /internal/match-engine/commit.',
  })
  @ApiParam({ name: 'institutionId', format: 'uuid', description: 'Host institution (Centre of Excellence) ID' })
  @ApiCreatedResponse({ description: 'The staged manual match.', type: MatchDto })
  @ApiBadRequestResponse({
    description: 'Missing reason, or the application is not eligible for this institution',
  })
  @ApiNotFoundResponse({ description: 'Institution or application not found' })
  @ApiConflictResponse({
    description: 'Institution already has a committed match, or the ESO is already staged elsewhere',
  })
  @Post('institutions/:institutionId/assign')
  assign(
    @Param('institutionId', ParseUUIDPipe) institutionId: string,
    @Body() dto: ManualAssignDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.matchingService.manualAssign(user.sub, institutionId, dto.applicationId, dto.reason);
  }

  /** Withdraw a staged manual pairing. */
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
