import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Match, MatchStatus } from './entities/match.entity';
import { Application } from '@/modules/applications/entities/application.entity';
import { Institution, HubType } from '@/modules/institutions/entities/institution.entity';
import { SectorFocus, ApplicationStatus } from '@/common/enums/application.enum';
import { ApplicationsStateMachineService } from '@/modules/applications/applications-state-machine.service';
import { AuditLogService } from '@/modules/audit-log/audit-log.service';
import { NotificationsService } from '@/modules/notifications/notifications.service';

const QUALIFICATION_THRESHOLD = 70.0; // percent — PRD 8.3's eligibility gate for the matching pool

// MCI weighting — the PRD names three factors ("specialised hub alignment, capacity,
// and institutional relationships") but does not specify exact weights. This gives
// hub alignment slightly more weight since the PRD lists it first and it is the one
// factor unique to this stage (capacity and institutional relationship are already
// reflected in the technical score that got the application this far). Adjust here if
// the programme team wants different weights — nothing else depends on these numbers.
const MCI_WEIGHTS = {
  hubAlignment: 0.4,
  capacity: 0.3,
  institutionalRelationship: 0.3,
};

export interface MciBreakdown {
  matchCompatibilityIndex: number;
  hubAlignmentScore: number;
  capacityAlignment: number;
  institutionalRelationshipScore: number;
}

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
   * "Specialised hub alignment" — how well the ESO's own stated sector focus lines up
   * with the specific hub type of the institution it applied to. STANDARD hubs are
   * broadly compatible with any sector focus (that is what "standard" means here);
   * GAMING/VR/CREATIVE hubs reward an ESO whose sector focus actually matches the
   * specialism, since that is the whole point of routing a specialised CoE to a
   * specialised partner.
   */
  private hubAlignmentScore(
    application: Application,
    institution: Institution,
  ): number {
    const sectors = application.sectorFocus ?? [];
    switch (institution.hubType) {
      case HubType.CREATIVE:
        if (sectors.includes(SectorFocus.CREATIVE)) return 100;
        if (sectors.includes(SectorFocus.HYBRID)) return 75;
        return 55;
      case HubType.GAMING:
      case HubType.VR:
        if (sectors.includes(SectorFocus.TECHNOLOGY)) return 100;
        if (sectors.includes(SectorFocus.HYBRID)) return 75;
        return 55;
      case HubType.STANDARD:
      default:
        return 80;
    }
  }

  /**
   * "Capacity" and "institutional relationships" are read from the same 6-dimension
   * rubric the technical scoring stage already produced (Domain 2 "Strong Team
   * Expertise" + Domain 5 "Programme Delivery Track Record" as the capacity proxy;
   * Domain 6 "Institutional Relationship & Alignment with Host Institution Needs" —
   * literally the named factor — for the third). Averaged across both scoring
   * reviewers' cards.
   */
  private computeMci(application: Application, institution: Institution): MciBreakdown {
    const cards = application.scoreCards ?? [];
    const avg = (pick: (c: (typeof cards)[number]) => number | null | undefined) => {
      const values = cards
        .map(pick)
        .filter((v): v is number => v !== null && v !== undefined);
      if (values.length === 0) return 0;
      return values.reduce((a, b) => a + b, 0) / values.length;
    };

    const capacityRaw =
      (avg((c) => c.teamExpertiseScore) + avg((c) => c.deliveryTrackRecordScore)) / 2;
    const institutionalRaw = avg((c) => c.institutionalAlignmentScore);

    const capacityAlignment = Math.round((capacityRaw / 5) * 100);
    const institutionalRelationshipScore = Math.round((institutionalRaw / 5) * 100);
    const hubAlignmentScore = this.hubAlignmentScore(application, institution);

    const matchCompatibilityIndex = Math.round(
      hubAlignmentScore * MCI_WEIGHTS.hubAlignment +
        capacityAlignment * MCI_WEIGHTS.capacity +
        institutionalRelationshipScore * MCI_WEIGHTS.institutionalRelationship,
    );

    return {
      matchCompatibilityIndex,
      hubAlignmentScore,
      capacityAlignment,
      institutionalRelationshipScore,
    };
  }

  /**
   * Partner Match Engine (PRD 8.3, TC-ADM-02) — Gale-Shapley stable matching with a
   * strict E_loc = I_loc geographic constraint and one ESO partner per host
   * institution (PRD 2).
   *
   * Every application already targets exactly one Centre of Excellence
   * (preferredInstitutionId, chosen at application time) rather than a ranked list of
   * institutions — so each "proposer" in the Gale-Shapley sense has a preference list
   * of length 1. That makes this a genuine but degenerate instance of the algorithm:
   * deferred acceptance normally needs multiple rounds so a rejected proposer can fall
   * back to their next choice, but with no second choice to fall back to, the
   * institution can just keep its single most-preferred proposer (ranked by MCI) and
   * reject the rest outright — it always converges in one round. If the data model
   * ever grows to support multiple ranked institution choices per ESO, this is the
   * method to extend into full multi-round deferred acceptance.
   *
   * Institutions that already have a MATCHED application keep it — MATCHED is a
   * terminal status (see ApplicationsStateMachineService) and re-running the engine
   * does not reopen a filled seat. Applications that lose the seat at their one
   * targeted institution are left at VALIDATED_SHORTLISTED (not auto-rejected): the
   * PRD does not define a "runner-up" outcome, and auto-rejecting a real applicant
   * organisation without a human decision felt like the wrong default. A SYSADMIN can
   * re-run the engine later or reject them explicitly.
   */
  async runMatch(actorId: string): Promise<Match[]> {
    const institutions = await this.institutionRepo.find({
      where: { isActive: true },
    });

    const alreadyMatched = await this.applicationRepo.find({
      where: { status: ApplicationStatus.MATCHED },
    });
    const filledInstitutionIds = new Set(
      alreadyMatched.map((a) => a.preferredInstitutionId).filter(Boolean),
    );
    const openInstitutions = institutions.filter(
      (i) => !filledInstitutionIds.has(i.id),
    );

    const candidates = await this.applicationRepo.find({
      where: { status: ApplicationStatus.VALIDATED_SHORTLISTED },
      relations: { preferredInstitution: true, scoreCards: true },
    });

    for (const institution of openInstitutions) {
      const proposers = candidates.filter(
        (app) =>
          app.preferredInstitutionId === institution.id &&
          (app.finalScorePercent ?? 0) >= QUALIFICATION_THRESHOLD &&
          app.preferredInstitution?.state?.trim().toUpperCase() ===
            institution.state.trim().toUpperCase(),
      );
      if (proposers.length === 0) continue;

      const scored = proposers
        .map((app) => ({ application: app, ...this.computeMci(app, institution) }))
        .sort(
          (a, b) =>
            b.matchCompatibilityIndex - a.matchCompatibilityIndex ||
            (b.application.finalScorePercent ?? 0) -
              (a.application.finalScorePercent ?? 0),
        );
      const winner = scored[0];

      // institutionId is UNIQUE at the DB level — clear any stale row from a
      // previous run before inserting the fresh one.
      await this.matchRepo.delete({ institutionId: institution.id });
      await this.matchRepo.delete({ applicationId: winner.application.id });

      const match = this.matchRepo.create({
        applicationId: winner.application.id,
        institutionId: institution.id,
        matchCompatibilityIndex: winner.matchCompatibilityIndex,
        breakdown: {
          hubAlignmentScore: winner.hubAlignmentScore,
          capacityAlignment: winner.capacityAlignment,
          institutionalRelationshipScore: winner.institutionalRelationshipScore,
        },
        state: institution.state,
        status: MatchStatus.GENERATED,
        matchedAt: new Date(),
      });
      await this.matchRepo.save(match);

      await this.applicationRepo.update(winner.application.id, {
        matchedAt: new Date(),
      });
      await this.stateMachine.transition(winner.application.id, {
        targetStatus: ApplicationStatus.MATCHED,
        actorId,
        role: 'ROLE_SYSADMIN',
        metadata: {
          institutionId: institution.id,
          matchCompatibilityIndex: winner.matchCompatibilityIndex,
        },
      });
      await this.auditLogService.record({
        actorId,
        actorRole: 'ROLE_SYSADMIN',
        action: 'PARTNER_MATCH_GENERATED',
        entityType: 'Application',
        entityId: winner.application.id,
        metadata: {
          institutionId: institution.id,
          institutionName: institution.name,
          matchCompatibilityIndex: winner.matchCompatibilityIndex,
        },
      });
      if (winner.application.primaryContactEmail) {
        await this.notificationsService.sendMatchedNotification(
          winner.application.primaryContactEmail,
          institution.name,
        );
      }
    }

    return this.getLastRun();
  }

  async getLastRun(): Promise<Match[]> {
    return this.matchRepo.find({
      relations: { application: true, institution: true },
      order: { matchedAt: 'DESC' },
    });
  }
}
