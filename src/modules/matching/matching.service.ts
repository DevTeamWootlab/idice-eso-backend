import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
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
    const alreadyMatched = await this.applicationRepo.find({
      where: { status: ApplicationStatus.MATCHED },
    });
    const filled = new Set(alreadyMatched.map((a) => a.preferredInstitutionId).filter(Boolean));
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
        status: MatchStatus.GENERATED,
        ...(matchIds && matchIds.length > 0 ? { id: In(matchIds) } : {}),
      },
      relations: { application: true, institution: true },
    });
    if (proposed.length === 0) {
      throw new BadRequestException('There are no proposed matches to approve. Run matching first.');
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
      const seatTaken = await this.applicationRepo.count({
        where: { status: ApplicationStatus.MATCHED, preferredInstitutionId: match.institutionId },
      });
      if (seatTaken > 0) {
        skipped.push({ matchId: match.id, reason: 'This institution already has a matched partner' });
        continue;
      }

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
    const matchedApplications = await this.applicationRepo.find({
      where: { status: ApplicationStatus.MATCHED },
      select: { id: true, preferredInstitutionId: true, organisationLegalName: true },
    });
    const committedAt = new Map<string, Application>(
      matchedApplications
        .filter((a: Application) => !!a.preferredInstitutionId)
        .map((a: Application) => [a.preferredInstitutionId, a] as [string, Application]),
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

  /** Eligible "validated but not matched" ESOs for one CoE, ranked by MCI against that CoE. */
  async getAssignableCandidates(institutionId: string) {
    const institution = await this.institutionRepo.findOne({ where: { id: institutionId } });
    if (!institution) throw new NotFoundException('Institution not found');

    const staged = await this.matchRepo.find({ where: { status: MatchStatus.AWAITING_APPROVAL } });
    const stagedApps = new Set(staged.map((m) => m.applicationId));

    const pool = await this.applicationRepo.find({
      where: { status: ApplicationStatus.VALIDATED_SHORTLISTED },
      relations: { preferredInstitution: true, scoreCards: true },
    });

    return pool
      .filter(
        (a) =>
          !stagedApps.has(a.id) &&
          (a.finalScorePercent ?? 0) >= QUALIFICATION_THRESHOLD &&
          (a.preferredInstitution?.state ?? '').trim().toUpperCase() ===
            institution.state.trim().toUpperCase(),
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
        return {
          applicationId: a.id,
          organisationLegalName: a.organisationLegalName,
          finalScorePercent: a.finalScorePercent,
          appliedToInstitutionId: a.preferredInstitutionId,
          ...mci,
        };
      })
      .sort(
        (x, y) =>
          y.matchCompatibilityIndex - x.matchCompatibilityIndex ||
          (y.finalScorePercent ?? 0) - (x.finalScorePercent ?? 0),
      );
  }

  /** Swap a suggestion or assign to an unmatched CoE. Stages as AWAITING_APPROVAL. */
  async manualAssign(actorId: string, institutionId: string, applicationId: string, reason: string) {
    if (!reason?.trim()) throw new BadRequestException('A reason is required for a manual pairing.');

    return this.matchRepo.manager.transaction(async (em) => {
      const matches = em.getRepository(Match);
      const institution = await em.getRepository(Institution).findOne({ where: { id: institutionId } });
      if (!institution || !institution.isActive) throw new NotFoundException('Institution not found or inactive');

      const seatTaken = await em.getRepository(Application).count({
        where: { status: ApplicationStatus.MATCHED, preferredInstitutionId: institutionId },
      });
      if (seatTaken > 0) throw new BadRequestException('This institution already has a matched partner');

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
      if (
        (application.preferredInstitution?.state ?? '').trim().toUpperCase() !==
        institution.state.trim().toUpperCase()
      ) {
        throw new BadRequestException('ESO and institution must be in the same state');
      }

      // A different staged institution for this application? Force an explicit cancel first.
      const appRow = await matches.findOne({ where: { applicationId } });
      if (appRow && appRow.institutionId !== institutionId && appRow.status === MatchStatus.AWAITING_APPROVAL) {
        throw new BadRequestException('This ESO is already staged for another institution. Cancel that pairing first.');
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
      if (appRow && appRow.id !== current?.id) await matches.delete({ id: appRow.id }); // stale GENERATED suggestion elsewhere

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
        action: current ? 'PARTNER_MATCH_OVERRIDDEN' : 'PARTNER_MATCH_MANUALLY_ASSIGNED',
        entityType: 'Application',
        entityId: applicationId,
        metadata: {
          institutionId,
          institutionName: institution.name,
          matchCompatibilityIndex: mci.matchCompatibilityIndex,
          replacedApplicationId: current?.applicationId ?? null,
          replacedMci: current?.matchCompatibilityIndex ?? null,
          reason: reason.trim(),
        },
      });
      return saved;
    });
  }

  /** Withdraw a staged manual pairing; next run proposes a system suggestion again. */
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
      relations: { application: true, institution: true },
      order: { matchCompatibilityIndex: 'DESC', matchedAt: 'DESC' },
    });
  }
}
