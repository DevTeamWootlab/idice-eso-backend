import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Not, Repository } from 'typeorm';
import { Application } from '../applications/entities/application.entity';
import { ScoreCard } from './entities/score-card.entity';
import { AuditLog } from '@/modules/audit-log/entities/audit-log.entity';
import { AuditLogService } from '@/modules/audit-log/audit-log.service';
import { NotificationsService } from '@/modules/notifications/notifications.service';
import { ApplicationsStateMachineService } from '../applications/applications-state-machine.service';
import { ApplicationStatus } from '@/common/enums/application.enum';
import { JwtPayload } from '@/common/interfaces/jwt-payload.interface';
import { averageOfPercents, toValidPercent } from './scoring-weights';

const VARIANCE_THRESHOLD = 15;
const QUALIFICATION_THRESHOLD = 70;
const SCORING_REJECTION_ACTION = 'SCORE_FINALIZED_REJECTED';

export interface ScoringIntegrityRow {
  applicationId: string;
  applicationRef: string;
  organisationName: string | null;
  status: ApplicationStatus;
  storedFinalScore: string | null;
  reviewer1Score: number | null;
  reviewer2Score: number | null;
  recomputedAverage: number | null;
  variance: number | null;
  rejectedByScoringGate: boolean;
  rejectedAt: string | null;
  integrityError: string | null;
  issue: string;
  recommendedOutcome: 'SHORTLIST' | 'ESCALATE_VARIANCE' | 'CONFIRM_REJECTION' | 'RETRY_FINALIZATION' | 'MANUAL_REVIEW';
}

@Injectable()
export class ScoringIntegrityService {
  constructor(
    @InjectRepository(Application)
    private readonly applicationRepo: Repository<Application>,
    @InjectRepository(ScoreCard)
    private readonly scoreCardRepo: Repository<ScoreCard>,
    private readonly stateMachine: ApplicationsStateMachineService,
    private readonly auditLogService: AuditLogService,
    private readonly notificationsService: NotificationsService,
  ) {}

  private get auditRepo(): Repository<AuditLog> {
    return this.applicationRepo.manager.getRepository(AuditLog);
  }

  async report(): Promise<{ items: ScoringIntegrityRow[]; total: number }> {
    const rejections = await this.auditRepo.find({
      where: { action: SCORING_REJECTION_ACTION, entityType: 'Application' },
      order: { createdAt: 'DESC' },
    });
    const rejectedAt = new Map<string, Date>();
    for (const row of rejections) {
      if (!rejectedAt.has(row.entityId)) rejectedAt.set(row.entityId, row.createdAt);
    }

    const flagged = await this.applicationRepo.find({
      where: { scoringIntegrityError: Not(IsNull()) },
      select: { id: true },
    });
    const ids = Array.from(new Set([...rejectedAt.keys(), ...flagged.map((a) => a.id)]));
    if (ids.length === 0) return { items: [], total: 0 };

    const applications = await this.applicationRepo.find({ where: { id: In(ids) } });
    const cards = await this.scoreCardRepo.find({
      where: { applicationId: In(ids), submitted: true },
      order: { reviewerSlot: 'ASC' },
    });

    const items: ScoringIntegrityRow[] = [];
    for (const app of applications) {
      const row = this.assess(app, cards.filter((c) => c.applicationId === app.id), rejectedAt.get(app.id));
      if (row) items.push(row);
    }
    return { items, total: items.length };
  }

  private assess(app: Application, cards: ScoreCard[], rejectedOn?: Date): ScoringIntegrityRow | null {
    const stored = app.finalScorePercent;
    const storedValid = toValidPercent(stored);
    const r1 = toValidPercent(cards[0]?.compositePercentage);
    const r2 = toValidPercent(cards[1]?.compositePercentage);
    const recomputed = averageOfPercents(r1, r2);
    const variance = r1 !== null && r2 !== null ? Math.round(Math.abs(r1 - r2) * 100) / 100 : null;
    const rejectedByScoringGate = app.status === ApplicationStatus.REJECTED && !!rejectedOn;

    let issue: string | null = null;
    let recommendedOutcome: ScoringIntegrityRow['recommendedOutcome'] = 'MANUAL_REVIEW';

    if (app.status === ApplicationStatus.IN_REVIEW_SCORING && app.scoringIntegrityError) {
      issue = `Finalization is on hold: ${app.scoringIntegrityError}`;
      recommendedOutcome = recomputed !== null ? 'RETRY_FINALIZATION' : 'MANUAL_REVIEW';
    } else if (rejectedByScoringGate && storedValid === null) {
      issue = 'Rejected by the scoring gate with a missing or invalid final score';
      if (recomputed === null || variance === null) recommendedOutcome = 'MANUAL_REVIEW';
      else if (variance > VARIANCE_THRESHOLD) recommendedOutcome = 'ESCALATE_VARIANCE';
      else if (recomputed >= QUALIFICATION_THRESHOLD) recommendedOutcome = 'SHORTLIST';
      else recommendedOutcome = 'CONFIRM_REJECTION';
    } else if (rejectedByScoringGate && recomputed !== null && recomputed >= QUALIFICATION_THRESHOLD) {
      issue = 'Rejected by the scoring gate although the reviewers\' average meets the 70% threshold';
      recommendedOutcome = variance !== null && variance > VARIANCE_THRESHOLD ? 'ESCALATE_VARIANCE' : 'SHORTLIST';
    } else if (app.scoringIntegrityError) {
      issue = app.scoringIntegrityError;
    }

    if (!issue) return null;
    return {
      applicationId: app.id,
      applicationRef: app.applicationRef,
      organisationName: app.organisationLegalName ?? null,
      status: app.status,
      storedFinalScore: stored === null || stored === undefined ? null : String(stored),
      reviewer1Score: r1,
      reviewer2Score: r2,
      recomputedAverage: recomputed,
      variance,
      rejectedByScoringGate,
      rejectedAt: rejectedOn ? rejectedOn.toISOString() : null,
      integrityError: app.scoringIntegrityError ?? null,
      issue,
      recommendedOutcome,
    };
  }

  async correctRejection(applicationId: string, note: string, actor: JwtPayload) {
    const trimmed = (note ?? '').trim();
    if (trimmed.length < 10) {
      throw new BadRequestException('Add a note of at least 10 characters explaining the correction');
    }
    const application = await this.applicationRepo.findOne({ where: { id: applicationId } });
    if (!application) throw new NotFoundException('Application not found');

    const gateRejection = await this.auditRepo.findOne({
      where: { action: SCORING_REJECTION_ACTION, entityType: 'Application', entityId: applicationId },
      order: { createdAt: 'DESC' },
    });
    if (application.status !== ApplicationStatus.REJECTED || !gateRejection) {
      throw new BadRequestException('Only applications rejected by the scoring gate can be corrected here');
    }

    const cards = await this.scoreCardRepo.find({
      where: { applicationId, submitted: true },
      order: { reviewerSlot: 'ASC' },
    });
    const row = this.assess(application, cards, gateRejection.createdAt);
    if (!row) {
      throw new BadRequestException('This rejection has a valid final score below the threshold and does not need correcting');
    }
    if (row.recomputedAverage === null || row.variance === null) {
      throw new BadRequestException('The two score cards do not produce a valid score; review them manually');
    }

    const before = { status: application.status, finalScorePercent: row.storedFinalScore };
    let outcome: 'SHORTLISTED' | 'PENDING_VALIDATION' | 'REJECTION_CONFIRMED';

    if (row.variance > VARIANCE_THRESHOLD) {
      await this.applicationRepo.update(
        { id: applicationId },
        { finalScorePercent: null, scoreVarianceFlagged: true, scoringIntegrityError: null },
      );
      await this.stateMachine.applyScoringCorrection(applicationId, ApplicationStatus.PENDING_VALIDATION);
      outcome = 'PENDING_VALIDATION';
    } else if (row.recomputedAverage >= QUALIFICATION_THRESHOLD) {
      await this.applicationRepo.update(
        { id: applicationId },
        { finalScorePercent: row.recomputedAverage, scoreVarianceFlagged: false, scoringIntegrityError: null },
      );
      await this.stateMachine.applyScoringCorrection(applicationId, ApplicationStatus.SHORTLISTED);
      outcome = 'SHORTLISTED';
    } else {
      await this.applicationRepo.update(
        { id: applicationId },
        { finalScorePercent: row.recomputedAverage, scoringIntegrityError: null },
      );
      outcome = 'REJECTION_CONFIRMED';
    }

    await this.auditLogService.record({
      actorId: actor.sub,
      actorRole: actor.role,
      action: 'SCORING_REJECTION_CORRECTED',
      entityType: 'Application',
      entityId: applicationId,
      metadata: {
        before,
        after: { outcome, finalScorePercent: outcome === 'PENDING_VALIDATION' ? null : row.recomputedAverage },
        reviewer1Score: row.reviewer1Score,
        reviewer2Score: row.reviewer2Score,
        variance: row.variance,
        note: trimmed,
      },
    });

    if (outcome === 'SHORTLISTED' && application.primaryContactEmail) {
      await this.notificationsService.sendShortlistedNotification(
        application.primaryContactEmail,
        row.recomputedAverage,
        application.applicationRef,
      );
    }

    return { applicationId, outcome, finalScorePercent: outcome === 'PENDING_VALIDATION' ? null : row.recomputedAverage };
  }
}
