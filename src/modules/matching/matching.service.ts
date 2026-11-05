import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Match, MatchSource, MatchStatus } from './entities/match.entity';
import { Application } from '@/modules/applications/entities/application.entity';
import { Institution } from '@/modules/institutions/entities/institution.entity';
import { ApplicationStatus } from '@/common/enums/application.enum';
import { ApplicationsStateMachineService } from '@/modules/applications/applications-state-machine.service';
import { AuditLogService } from '@/modules/audit-log/audit-log.service';
import { NotificationsService } from '@/modules/notifications/notifications.service';
import { MatchCandidate, QUALIFICATION_THRESHOLD, computeMci, proposeMatches } from './matching-rules';

export interface UnmatchedApplication {
  applicationId: string;
  applicationRef: string;
  organisationName: string | null;
  finalScorePercent: number | null;
  institutionId: string | null;
  institutionName: string | null;
  state: string | null;
  matchCompatibilityIndex: number | null;
  reason: string;
}

export type { MciBreakdown } from './matching-rules';

const OPEN_PAIRING_STATUSES = [MatchStatus.GENERATED, MatchStatus.AWAITING_APPROVAL];
const LIVE_PAIRING_STATUSES = [MatchStatus.GENERATED, MatchStatus.AWAITING_APPROVAL, MatchStatus.ACCEPTED];

const sameState = (a: string | null | undefined, b: string | null | undefined) =>
  (a ?? '').trim().toUpperCase() === (b ?? '').trim().toUpperCase();

@Injectable()
export class MatchingService {
  constructor(
    @InjectRepository(Match)
    private readonly matchRepo: Repository<Match>,
    @InjectRepository(Application)
    private readonly applicationRepo: Repository<Application>,
    @InjectRepository(Institution)
    private readonly institutionRepo: Repository<Institution>,
    private readonly stateMachine: ApplicationsStateMachineService,
    private readonly auditLogService: AuditLogService,
    private readonly notificationsService: NotificationsService,
  ) {}

  private async committedSeats(): Promise<Map<string, string>> {
    const accepted = await this.matchRepo.find({ where: { status: MatchStatus.ACCEPTED } });
    const seats = new Map<string, string>(accepted.map((m) => [m.institutionId, m.applicationId]));
    const withMatch = new Set(accepted.map((m) => m.applicationId));
    const legacy = await this.applicationRepo.find({
      where: { status: ApplicationStatus.MATCHED },
      select: { id: true, preferredInstitutionId: true },
    });
    for (const app of legacy) {
      if (withMatch.has(app.id) || !app.preferredInstitutionId) continue;
      if (!seats.has(app.preferredInstitutionId)) seats.set(app.preferredInstitutionId, app.id);
    }
    return seats;
  }

  /**
   * Step 1 — PROPOSE. Computes the best ESO partner for every open institution from the
   * applications' own scores and profile (see matching-rules.ts — no randomness) and stores
   * them as GENERATED proposals. Nothing about any application changes and nobody is
   * emailed until a SYSADMIN approves the proposals with commitMatches().
   *
   * Re-running replaces earlier proposals; committed (ACCEPTED) matches are never touched,
   * and an institution that already has a MATCHED partner is not reopened.
   */
  async runMatch(actorId: string): Promise<Match[]> {
    const staged = await this.matchRepo.find({
      where: { status: MatchStatus.AWAITING_APPROVAL },
    });
    const stagedInstitutions = new Set(staged.map((m) => m.institutionId));
    const stagedApplications = new Set(staged.map((m) => m.applicationId));

    const institutions = await this.institutionRepo.find({ where: { isActive: true } });
    const filled = await this.committedSeats();
    const open = institutions.filter((i) => !filled.has(i.id) && !stagedInstitutions.has(i.id));

    const pool = (
      await this.applicationRepo.find({
        where: { status: ApplicationStatus.VALIDATED_SHORTLISTED },
        relations: { preferredInstitution: true, scoreCards: true },
      })
    ).filter((a) => !stagedApplications.has(a.id));

    const candidates: MatchCandidate[] = pool.map((app) => ({
      applicationId: app.id,
      institutionId: app.preferredInstitutionId,
      institutionState: app.preferredInstitution?.state ?? '',
      finalScorePercent: app.finalScorePercent ?? null,
      sectorFocus: app.sectorFocus ?? [],
      scoreCards: app.scoreCards ?? [],
    }));

    const proposals = proposeMatches(
      candidates,
      open.map((i) => ({ id: i.id, state: i.state, hubType: i.hubType })),
    );

    // Replace the previous set of proposals wholesale (institutionId is UNIQUE).
    await this.matchRepo.delete({ status: MatchStatus.GENERATED });
    for (const proposal of proposals) {
      const institution = open.find((i) => i.id === proposal.institutionId) as Institution;
      await this.matchRepo.delete({ applicationId: proposal.applicationId });
      await this.matchRepo.save(
        this.matchRepo.create({
          applicationId: proposal.applicationId,
          institutionId: proposal.institutionId,
          matchCompatibilityIndex: proposal.matchCompatibilityIndex,
          breakdown: {
            hubAlignmentScore: proposal.hubAlignmentScore,
            capacityAlignment: proposal.capacityAlignment,
            institutionalRelationshipScore: proposal.institutionalRelationshipScore,
          },
          state: institution.state,
          status: MatchStatus.GENERATED,
          matchedAt: new Date(),
          source: MatchSource.SYSTEM,
        }),
      );
      await this.auditLogService.record({
        actorId,
        actorRole: 'ROLE_SYSADMIN',
        action: 'PARTNER_MATCH_GENERATED',
        entityType: 'Application',
        entityId: proposal.applicationId,
        metadata: {
          institutionId: proposal.institutionId,
          institutionName: institution.name,
          matchCompatibilityIndex: proposal.matchCompatibilityIndex,
        },
      });
    }
    return this.getLastRun();
  }

  /**
   * Step 2 — APPROVE / COMMIT. Moves the approved applications to MATCHED, marks the match
   * ACCEPTED, records the decision and emails the ESO. Each proposal is re-checked at
   * commit time, so a proposal that went stale since it was generated is skipped with a
   * reason instead of being forced through.
   */
  async commitMatches(actorId: string, matchIds?: string[]) {
    const proposed = await this.matchRepo.find({
      where: {
        status: In(OPEN_PAIRING_STATUSES),
        ...(matchIds && matchIds.length > 0 ? { id: In(matchIds) } : {}),
      },
      relations: { application: { preferredInstitution: true }, institution: true },
    });
    if (proposed.length === 0) {
      throw new BadRequestException('There are no matches awaiting approval. Run matching or assign an ESO first.');
    }

    let committed = 0;
    const skipped: { matchId: string; reason: string }[] = [];

    for (const match of proposed) {
      const application = await this.applicationRepo.findOne({ where: { id: match.applicationId } });
      if (!application || application.status !== ApplicationStatus.VALIDATED_SHORTLISTED) {
        skipped.push({
          matchId: match.id,
          reason: `The application is now ${application?.status ?? 'missing'} and can no longer be matched`,
        });
        continue;
      }
      const seats = await this.committedSeats();
      if (seats.has(match.institutionId)) {
        skipped.push({ matchId: match.id, reason: 'This institution already has a matched partner' });
        continue;
      }
      const esoState = match.application?.preferredInstitution?.state ?? null;
      const crossState = !sameState(esoState, match.institution?.state ?? match.state);

      await this.stateMachine.transition(application.id, {
        targetStatus: ApplicationStatus.MATCHED,
        actorId,
        role: 'ROLE_SYSADMIN',
        metadata: {
          institutionId: match.institutionId,
          matchCompatibilityIndex: match.matchCompatibilityIndex,
        },
      });
      await this.applicationRepo.update(application.id, { matchedAt: new Date() });
      await this.matchRepo.update(match.id, { status: MatchStatus.ACCEPTED, matchedAt: new Date() });
      await this.auditLogService.record({
        actorId,
        actorRole: 'ROLE_SYSADMIN',
        action: 'PARTNER_MATCH_COMMITTED',
        entityType: 'Application',
        entityId: application.id,
        metadata: {
          institutionId: match.institutionId,
          institutionName: match.institution?.name,
          matchCompatibilityIndex: match.matchCompatibilityIndex,
          source: match.source,
          crossState,
          esoState,
          institutionState: match.institution?.state ?? match.state,
        },
      });
      if (application.primaryContactEmail) {
        await this.notificationsService.sendMatchedNotification(
          application.primaryContactEmail,
          match.institution?.name ?? 'your host institution',
          application.applicationRef,
        );
      }
      committed += 1;
    }

    return { committed, skipped, matches: await this.getLastRun() };
  }

  async getUnmatched(): Promise<UnmatchedApplication[]> {
    const pool = await this.applicationRepo.find({
      where: { status: ApplicationStatus.VALIDATED_SHORTLISTED },
      relations: { preferredInstitution: true, scoreCards: true },
      order: { finalScorePercent: 'DESC' },
    });
    if (pool.length === 0) return [];

    const matches = await this.matchRepo.find({ relations: { application: true, institution: true } });
    const byApplication = new Map<string, Match>(matches.map((m: Match) => [m.applicationId, m]));
    const byInstitution = new Map<string, Match>(matches.map((m: Match) => [m.institutionId, m]));
    const seats = await this.committedSeats();
    const seatHolders = seats.size
      ? await this.applicationRepo.find({
          where: { id: In([...seats.values()]) },
          select: { id: true, organisationLegalName: true },
        })
      : [];
    const holderNames = new Map(seatHolders.map((a) => [a.id, a]));
    const committedAt = new Map<string, Application | undefined>(
      [...seats.entries()].map(([institutionId, applicationId]) => [institutionId, holderNames.get(applicationId)]),
    );

    const rows: UnmatchedApplication[] = [];
    for (const app of pool) {
      const current = byApplication.get(app.id);
      if (current && current.status !== MatchStatus.REJECTED) continue;

      const institution = app.preferredInstitution ?? null;
      const finalScore = app.finalScorePercent === null || app.finalScorePercent === undefined ? null : Number(app.finalScorePercent);
      const base = {
        applicationId: app.id,
        applicationRef: app.applicationRef,
        organisationName: app.organisationLegalName ?? null,
        finalScorePercent: finalScore,
        institutionId: institution?.id ?? null,
        institutionName: institution?.name ?? null,
        state: institution?.state ?? null,
      };
      const mci = institution
        ? computeMci(
            {
              applicationId: app.id,
              institutionId: institution.id,
              institutionState: institution.state,
              finalScorePercent: finalScore,
              sectorFocus: app.sectorFocus ?? [],
              scoreCards: app.scoreCards ?? [],
            },
            { id: institution.id, state: institution.state, hubType: institution.hubType },
          ).matchCompatibilityIndex
        : null;

      let reason: string;
      if (!institution) {
        reason = 'No Centre of Excellence is selected on this application, so it cannot be paired.';
      } else if (!institution.isActive) {
        reason = `${institution.name} is marked inactive, so it is left out of matching.`;
      } else if (finalScore === null || !(finalScore >= QUALIFICATION_THRESHOLD)) {
        reason = `The final score (${finalScore ?? 'none'}) is below the ${QUALIFICATION_THRESHOLD}% matching threshold.`;
      } else if (committedAt.has(institution.id)) {
        const holder = committedAt.get(institution.id);
        reason = `${institution.name} already has an approved partner (${holder?.organisationLegalName ?? 'another ESO'}). Each Centre of Excellence takes one ESO.`;
      } else if (byInstitution.has(institution.id)) {
        const winner = byInstitution.get(institution.id) as Match;
        reason = `${institution.name} was proposed to ${winner.application?.organisationLegalName ?? 'another ESO'}, which ranked higher (match index ${Number(winner.matchCompatibilityIndex)} against ${mci ?? 'n/a'}). Each Centre of Excellence takes one ESO.`;
      } else {
        reason = 'Not included in the latest run. Run matching again to include it.';
      }
      rows.push({ ...base, matchCompatibilityIndex: mci, reason });
    }
    return rows;
  }

  async getAssignableCandidates(institutionId: string, crossState = false) {
    const institution = await this.institutionRepo.findOne({ where: { id: institutionId } });
    if (!institution) throw new NotFoundException('Institution not found');

    const pairings = await this.matchRepo.find({
      where: { status: In(LIVE_PAIRING_STATUSES) },
      relations: { institution: true },
    });
    const pairedByApplication = new Map(pairings.map((m) => [m.applicationId, m]));

    const pool = await this.applicationRepo.find({
      where: { status: ApplicationStatus.VALIDATED_SHORTLISTED },
      relations: { preferredInstitution: true, scoreCards: true },
    });

    return pool
      .filter(
        (a) =>
          (a.finalScorePercent ?? 0) >= QUALIFICATION_THRESHOLD &&
          (crossState || sameState(a.preferredInstitution?.state, institution.state)),
      )
      .map((a) => {
        const mci = computeMci(
          {
            applicationId: a.id,
            institutionId: a.preferredInstitutionId,
            institutionState: a.preferredInstitution?.state ?? '',
            finalScorePercent: a.finalScorePercent ?? null,
            sectorFocus: a.sectorFocus ?? [],
            scoreCards: a.scoreCards ?? [],
          },
          { id: institution.id, state: institution.state, hubType: institution.hubType },
        );
        const pairing = pairedByApplication.get(a.id) ?? null;
        return {
          applicationId: a.id,
          organisationLegalName: a.organisationLegalName,
          finalScorePercent: a.finalScorePercent,
          appliedToInstitutionId: a.preferredInstitutionId,
          appliedToInstitutionName: a.preferredInstitution?.name ?? null,
          state: a.preferredInstitution?.state ?? null,
          isCrossState: !sameState(a.preferredInstitution?.state, institution.state),
          isCurrentMatch: pairing?.institutionId === institutionId,
          pairedWith: pairing
            ? {
                matchId: pairing.id,
                institutionId: pairing.institutionId,
                institutionName: pairing.institution?.name ?? null,
                status: pairing.status,
              }
            : null,
          ...mci,
        };
      })
      .sort(
        (x, y) =>
          Number(!!x.pairedWith) - Number(!!y.pairedWith) ||
          y.matchCompatibilityIndex - x.matchCompatibilityIndex ||
          (y.finalScorePercent ?? 0) - (x.finalScorePercent ?? 0),
      );
  }

  async getOverview() {
    const institutions = await this.institutionRepo.find({ where: { isActive: true }, order: { state: 'ASC', name: 'ASC' } });
    const pairings = await this.matchRepo.find({
      where: { status: In(LIVE_PAIRING_STATUSES) },
      relations: { application: { preferredInstitution: true }, institution: true },
    });
    const byInstitution = new Map(pairings.map((m) => [m.institutionId, m]));
    const seats = await this.committedSeats();
    const legacyHolders = [...seats.entries()].filter(([institutionId]) => !byInstitution.has(institutionId));
    const legacyApps = legacyHolders.length
      ? await this.applicationRepo.find({ where: { id: In(legacyHolders.map(([, id]) => id)) } })
      : [];
    const legacyByInstitution = new Map(
      legacyHolders.map(([institutionId, applicationId]) => [institutionId, legacyApps.find((a) => a.id === applicationId)]),
    );

    const rows = institutions.map((institution) => {
      const match = byInstitution.get(institution.id) ?? null;
      const legacy = legacyByInstitution.get(institution.id) ?? null;
      const esoState = match?.application?.preferredInstitution?.state ?? null;
      return {
        institutionId: institution.id,
        institutionName: institution.name,
        state: institution.state,
        hubType: institution.hubType,
        hasSameStateCandidate: false,
        match: match
          ? {
              id: match.id,
              applicationId: match.applicationId,
              organisationLegalName: match.application?.organisationLegalName ?? null,
              finalScorePercent: match.application?.finalScorePercent ?? null,
              esoState,
              isCrossState: !!esoState && !sameState(esoState, institution.state),
              matchCompatibilityIndex: Number(match.matchCompatibilityIndex),
              breakdown: match.breakdown,
              status: match.status,
              source: match.source,
              overriddenApplicationId: match.overriddenApplicationId,
              overrideReason: match.overrideReason,
              matchedAt: match.matchedAt ? new Date(match.matchedAt).toISOString() : null,
            }
          : legacy
            ? {
                id: null,
                applicationId: legacy.id,
                organisationLegalName: legacy.organisationLegalName ?? null,
                finalScorePercent: legacy.finalScorePercent ?? null,
                esoState: null,
                isCrossState: false,
                matchCompatibilityIndex: null,
                breakdown: null,
                status: MatchStatus.ACCEPTED,
                source: MatchSource.SYSTEM,
                overriddenApplicationId: null,
                overrideReason: null,
                matchedAt: legacy.matchedAt ? new Date(legacy.matchedAt).toISOString() : null,
              }
            : null,
      };
    });

    const pool = await this.applicationRepo.find({
      where: { status: ApplicationStatus.VALIDATED_SHORTLISTED },
      relations: { preferredInstitution: true },
    });
    const pairedApps = new Set(pairings.map((m) => m.applicationId));
    const freeStates = pool
      .filter((a) => (a.finalScorePercent ?? 0) >= QUALIFICATION_THRESHOLD && !pairedApps.has(a.id))
      .map((a) => (a.preferredInstitution?.state ?? '').trim().toUpperCase());
    for (const row of rows) {
      row.hasSameStateCandidate = freeStates.includes(row.state.trim().toUpperCase());
    }

    const paired = rows.filter((r) => r.match);
    return {
      summary: {
        institutions: rows.length,
        paired: paired.length,
        unassigned: rows.length - paired.length,
        awaitingApproval: paired.filter((r) => r.match && r.match.status !== MatchStatus.ACCEPTED).length,
        approved: paired.filter((r) => r.match?.status === MatchStatus.ACCEPTED).length,
        manualOverrides: paired.filter((r) => r.match?.source === MatchSource.MANUAL).length,
        crossState: paired.filter((r) => r.match?.isCrossState).length,
        availableEsos: freeStates.length,
      },
      institutions: rows,
    };
  }

  async manualAssign(
    actorId: string,
    institutionId: string,
    applicationId: string,
    reason: string,
    allowCrossState = false,
  ) {
    if (!reason?.trim()) throw new BadRequestException('A reason is required for a manual pairing.');

    return this.matchRepo.manager.transaction(async (em) => {
      const matches = em.getRepository(Match);
      const institution = await em.getRepository(Institution).findOne({ where: { id: institutionId } });
      if (!institution || !institution.isActive) throw new NotFoundException('Institution not found or inactive');

      if ((await this.committedSeats()).has(institutionId)) {
        throw new BadRequestException('This institution already has a matched partner');
      }

      const application = await em.getRepository(Application).findOne({
        where: { id: applicationId },
        relations: { preferredInstitution: true, scoreCards: true },
      });
      if (!application || application.status !== ApplicationStatus.VALIDATED_SHORTLISTED) {
        throw new BadRequestException('Only validated, unmatched ESOs can be assigned');
      }
      if ((application.finalScorePercent ?? 0) < QUALIFICATION_THRESHOLD) {
        throw new BadRequestException(`Final score is below the ${QUALIFICATION_THRESHOLD}% threshold`);
      }
      const esoState = application.preferredInstitution?.state ?? null;
      const crossState = !sameState(esoState, institution.state);
      if (crossState && !allowCrossState) {
        throw new BadRequestException(
          'ESO and institution must be in the same state. Turn on cross-state pairing to assign an ESO from another state.',
        );
      }

      const appRow = await matches.findOne({ where: { applicationId }, relations: { institution: true } });
      if (appRow && appRow.institutionId !== institutionId && LIVE_PAIRING_STATUSES.includes(appRow.status)) {
        throw new ConflictException(
          `This ESO is already paired with ${appRow.institution?.name ?? 'another institution'}. Override or withdraw that pairing first.`,
        );
      }

      const current = await matches.findOne({ where: { institutionId } });
      if (current?.status === MatchStatus.ACCEPTED) {
        throw new BadRequestException('This institution already has a committed match');
      }
      if (current?.applicationId === applicationId && current.status === MatchStatus.AWAITING_APPROVAL) {
        throw new BadRequestException('This pairing is already staged');
      }

      // Free both unique keys, then insert the manual row.
      if (current) await matches.delete({ id: current.id });
      if (appRow && appRow.id !== current?.id) await matches.delete({ id: appRow.id });

      const mci = computeMci(
        {
          applicationId,
          institutionId: application.preferredInstitutionId,
          institutionState: application.preferredInstitution?.state ?? '',
          finalScorePercent: application.finalScorePercent ?? null,
          sectorFocus: application.sectorFocus ?? [],
          scoreCards: application.scoreCards ?? [],
        },
        { id: institution.id, state: institution.state, hubType: institution.hubType },
      );

      const saved = await matches.save(
        matches.create({
          applicationId,
          institutionId,
          matchCompatibilityIndex: mci.matchCompatibilityIndex,
          breakdown: {
            hubAlignmentScore: mci.hubAlignmentScore,
            capacityAlignment: mci.capacityAlignment,
            institutionalRelationshipScore: mci.institutionalRelationshipScore,
          },
          state: institution.state,
          status: MatchStatus.AWAITING_APPROVAL,
          source: MatchSource.MANUAL,
          overriddenApplicationId: current?.applicationId ?? null,
          overrideReason: reason.trim(),
          assignedByUserId: actorId,
          matchedAt: new Date(),
        }),
      );

      await this.auditLogService.record({
        actorId,
        actorRole: 'ROLE_SYSADMIN',
        action: crossState
          ? 'PARTNER_MATCH_CROSS_STATE_ASSIGNED'
          : current
            ? 'PARTNER_MATCH_OVERRIDDEN'
            : 'PARTNER_MATCH_MANUALLY_ASSIGNED',
        entityType: 'Application',
        entityId: applicationId,
        metadata: {
          institutionId,
          institutionName: institution.name,
          matchCompatibilityIndex: mci.matchCompatibilityIndex,
          replacedApplicationId: current?.applicationId ?? null,
          replacedMci: current?.matchCompatibilityIndex ?? null,
          reason: reason.trim(),
          crossState,
          crossStateException: crossState ? { esoState, institutionState: institution.state } : null,
          assignedByUserId: actorId,
        },
      });
      return matches.findOneOrFail({
        where: { id: saved.id },
        relations: { application: { preferredInstitution: true }, institution: true },
      });
    });
  }

  async cancelManualAssignment(actorId: string, matchId: string) {
    const match = await this.matchRepo.findOne({ where: { id: matchId } });
    if (!match || match.status !== MatchStatus.AWAITING_APPROVAL) {
      throw new BadRequestException('Only pairings awaiting approval can be cancelled');
    }
    await this.matchRepo.delete({ id: matchId });
    await this.auditLogService.record({
      actorId,
      actorRole: 'ROLE_SYSADMIN',
      action: 'PARTNER_MATCH_MANUAL_CANCELLED',
      entityType: 'Application',
      entityId: match.applicationId,
      metadata: { institutionId: match.institutionId },
    });
  }

  async getLastRun(): Promise<Match[]> {
    return this.matchRepo.find({
      relations: { application: { preferredInstitution: true }, institution: true },
      order: { matchCompatibilityIndex: 'DESC', matchedAt: 'DESC' },
    });
  }
}
