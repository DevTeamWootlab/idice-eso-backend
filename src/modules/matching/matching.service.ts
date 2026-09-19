import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Match, MatchStatus } from './entities/match.entity';
import { Application } from '@/modules/applications/entities/application.entity';
import { Institution } from '@/modules/institutions/entities/institution.entity';
import { ApplicationStatus } from '@/common/enums/application.enum';
import { ApplicationsStateMachineService } from '@/modules/applications/applications-state-machine.service';
import { AuditLogService } from '@/modules/audit-log/audit-log.service';
import { NotificationsService } from '@/modules/notifications/notifications.service';
import { MatchCandidate, proposeMatches } from './matching-rules';

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
    const institutions = await this.institutionRepo.find({ where: { isActive: true } });
    const alreadyMatched = await this.applicationRepo.find({
      where: { status: ApplicationStatus.MATCHED },
    });
    const filled = new Set(alreadyMatched.map((a) => a.preferredInstitutionId).filter(Boolean));
    const open = institutions.filter((i) => !filled.has(i.id));

    const pool = await this.applicationRepo.find({
      where: { status: ApplicationStatus.VALIDATED_SHORTLISTED },
      relations: { preferredInstitution: true, scoreCards: true },
    });
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
        );
      }
      committed += 1;
    }

    return { committed, skipped, matches: await this.getLastRun() };
  }

  async getLastRun(): Promise<Match[]> {
    return this.matchRepo.find({
      relations: { application: true, institution: true },
      order: { matchCompatibilityIndex: 'DESC', matchedAt: 'DESC' },
    });
  }
}
