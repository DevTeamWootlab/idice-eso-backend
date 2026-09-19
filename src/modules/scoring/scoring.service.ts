// modules/scoring/scoring.service.ts
import { BadRequestException, ForbiddenException, Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntityManager } from 'typeorm';
import { RubricConfiguration } from './entities/rubric-configuration.entity';
import { UpdateScoringWeightsDto } from './dto/scoring-weights.dto';
import { JwtPayload } from '@/common/interfaces/jwt-payload.interface';
import { ScoreCard } from './entities/score-card.entity';
import { Application } from '../applications/entities/application.entity';
import { ReviewerAssignment } from '../applications/entities/reviewer-assignment.entity';
import { ApplicationsStateMachineService } from '../applications/applications-state-machine.service';
import { ApplicationStatus } from '@/common/enums/application.enum';
import { ReviewerQueueType } from '@/common/enums/reviewer.enum';
import { SubmitScoreDto } from './dto/submit-score.dto';
import { AuditLogService } from '@/modules/audit-log/audit-log.service';
import { NotificationsService } from '@/modules/notifications/notifications.service';
import { RUBRIC_DIMENSIONS, compositePercent, resolveWeights, validateWeightsInput, RubricWeights } from './scoring-weights';
import { User } from '@/modules/users/entities/user.entity';

const VARIANCE_THRESHOLD = 15; // percentage points
const QUALIFICATION_THRESHOLD = 70.0; // percent

@Injectable()
export class ScoringService {
  constructor(
    @InjectRepository(ScoreCard)
    private readonly scoreCardRepo: Repository<ScoreCard>,
    @InjectRepository(RubricConfiguration)
    private readonly rubricRepo: Repository<RubricConfiguration>,
    @InjectRepository(Application)
    private readonly applicationRepo: Repository<Application>,
    @InjectRepository(ReviewerAssignment)
    private readonly assignmentRepo: Repository<ReviewerAssignment>,
    private readonly stateMachine: ApplicationsStateMachineService,
    private readonly auditLogService: AuditLogService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async getQueue(reviewerId: string) {
    const assignments = await this.assignmentRepo.find({
      where: {
        reviewerId,
        queueType: ReviewerQueueType.SCORING,
        completed: false,
      },
      relations: {
        application: true,
      },
    });

    return assignments
      .filter(
        (a) => a.application.status === ApplicationStatus.IN_REVIEW_SCORING,
      )
      .map((a) => a.application);
  }

  async getDossier(applicationId: string, reviewerId: string) {
    await this.assertAssigned(applicationId, reviewerId);
    const application = await this.applicationRepo.findOne({
      where: { id: applicationId },
      relations: {
        references: true,
        documents: true,
        scoreCards: { reviewer: true },
      },
    });
    if (!application) throw new NotFoundException('Application not found');

    // TC-SCO-03 — both cards are only safe to unblind once scoring has actually
    // finalized (average taken, or escalated for variance). While still
    // IN_REVIEW_SCORING, strip every card so the caller's co-reviewer stays hidden,
    // even though the relation was fetched (simpler than a conditional query).
    if (application.status === ApplicationStatus.IN_REVIEW_SCORING) {
      application.scoreCards = [];
    }
    return application;
  }

  private async assertAssigned(applicationId: string, reviewerId: string) {
    const assignment = await this.assignmentRepo.findOne({
      where: {
        applicationId,
        reviewerId,
        queueType: ReviewerQueueType.SCORING,
      },
    });
    if (!assignment) {
      throw new ForbiddenException(
        'You are not assigned to score this application',
      );
    }
    return assignment;
  }

  /**
   * TC-SCO-03 — Reviewer 1's card is invisible to Reviewer 2 and vice versa
   * until BOTH have submitted. This only ever returns the caller's own card.
   */
  async getMyScore(applicationId: string, reviewerId: string) {
    await this.assertAssigned(applicationId, reviewerId);
    return this.scoreCardRepo.findOne({ where: { applicationId, reviewerId } });
  }

  /**
   * TC-SCO-01, TC-SCO-02, TC-SCO-03, TC-SCO-04
   */
  async submitScore(
    applicationId: string,
    reviewerId: string,
    dto: SubmitScoreDto,
  ) {
    const assignment = await this.assertAssigned(applicationId, reviewerId);

    const application = await this.applicationRepo.findOne({
      where: { id: applicationId },
    });
    if (!application) throw new NotFoundException('Application not found');
    if (application.status !== ApplicationStatus.IN_REVIEW_SCORING) {
      throw new BadRequestException(
        `Application is in ${application.status} status and is not awaiting scoring`,
      );
    }

    let card = await this.scoreCardRepo.findOne({
      where: { applicationId, reviewerId },
    });

    if (card?.submitted) {
      throw new BadRequestException(
        'You have already submitted your score for this application',
      );
    }
    const weights = await this.loadWeights();
    const compositePercentage = this.calculateComposite(dto, weights);
    if (!card) {
      const existingCount = await this.scoreCardRepo.count({
        where: { applicationId },
      });
      if (existingCount >= 2) {
        throw new BadRequestException(
          'Two score cards already exist for this application',
        );
      }
      card = this.scoreCardRepo.create({
        applicationId,
        reviewerId,
        // The reviewer's designated slot (Reviewer 1 / Reviewer 2); falls back to arrival order
        // only for legacy accounts that were provisioned before slots existed.
        reviewerSlot: (await this.reviewerSlotOf(reviewerId)) ?? existingCount + 1,
      });
    }
    Object.assign(card, dto);
    card.compositePercentage = compositePercentage;
    card.submitted = true;
    card.submittedAt = new Date();
    await this.scoreCardRepo.save(card);

    assignment.completed = true;
    await this.assignmentRepo.save(assignment);

    // Tell the other reviewer their counterpart has scored (without revealing the score).
    const counterparts = await this.assignmentRepo.find({
      where: { applicationId, queueType: ReviewerQueueType.SCORING },
    });
    for (const other of counterparts.filter((a) => a.reviewerId !== reviewerId && !a.completed)) {
      await this.notificationsService.notifyUser(
        other.reviewerId,
        'Your counterpart has submitted their score',
        `The other scoring reviewer has scored ${application.organisationLegalName || application.applicationRef}. Submit your score to complete scoring.`,
        `/internal/applications/${applicationId}`,
      );
    }

    await this.auditLogService.record({
      actorId: reviewerId,
      actorRole: 'ROLE_SCORING_REVIEWER',
      action: 'SCORE_SUBMITTED',
      entityType: 'Application',
      entityId: applicationId,
      // Deliberately no raw score/compositePercentage in metadata here — the other
      // reviewer may read this application's audit trail before they've submitted
      // their own card, and that must not leak a blinded score early.
      metadata: { reviewerSlot: card.reviewerSlot },
    });

    return this.tryFinalize(applicationId, reviewerId, application.primaryContactEmail);
  }

  private calculateComposite(
    scores: SubmitScoreDto,
    weights: RubricWeights,
  ): number {
    return compositePercent(scores, weights);
  }

  private async reviewerSlotOf(reviewerId: string): Promise<number | null> {
    const reviewer = await this.applicationRepo.manager
      .getRepository(User)
      .findOne({ where: { id: reviewerId } });
    return reviewer?.scoringSlot ?? null;
  }

  private async loadWeights(): Promise<RubricWeights> {
    const rows = await this.rubricRepo.find({ where: { isActive: true } });
    return resolveWeights(rows);
  }

  async getWeightsState() {
    const rows = await this.rubricRepo.find({ where: { isActive: true } });
    const weights = resolveWeights(rows);
    const labels = new Map(rows.map((row) => [row.dimensionCode, row.label]));
    const submitted = await this.scoreCardRepo.count({
      where: { submitted: true },
    });
    const locked = submitted > 0;
    return {
      weights: RUBRIC_DIMENSIONS.map((dimension) => ({
        dimensionCode: dimension.code,
        label: labels.get(dimension.code) ?? dimension.label,
        weightPercentage: weights[dimension.code],
      })),
      locked,
      lockedReason: locked
        ? 'Scoring has started: at least one score card has been submitted, so the weights are locked to keep every application scored on the same basis.'
        : null,
    };
  }

  async updateWeights(dto: UpdateScoringWeightsDto, actor: JwtPayload) {
    const problem = validateWeightsInput(dto.weights);
    if (problem) throw new BadRequestException(problem);

    const before = await this.getWeightsState();
    if (before.locked) {
      throw new ConflictException(before.lockedReason as string);
    }

    await this.rubricRepo.manager.transaction(async (manager: EntityManager) => {
      const repo = manager.getRepository(RubricConfiguration);
      for (const input of dto.weights) {
        const dimension = RUBRIC_DIMENSIONS.find(
          (d) => d.code === input.dimensionCode,
        );
        await repo.upsert(
          {
            dimensionCode: input.dimensionCode,
            label: dimension?.label ?? input.dimensionCode,
            weightPercentage: input.weightPercentage,
            isActive: true,
          },
          ['dimensionCode'],
        );
      }
    });

    await this.auditLogService.record({
      actorId: actor.sub,
      actorRole: actor.role,
      action: 'SCORING_WEIGHTS_UPDATED',
      entityType: 'RubricConfiguration',
      entityId: 'scoring-weights',
      metadata: {
        before: before.weights,
        after: dto.weights,
      },
    });

    return this.getWeightsState();
  }

  /**
   * Called after every score submission — only actually finalizes
   * once BOTH scoring reviewers for this application have submitted.
   */
  private async tryFinalize(
    applicationId: string,
    actorId: string,
    applicantEmail?: string,
  ) {
    const cards = await this.scoreCardRepo.find({
      where: { applicationId, submitted: true },
    });

    if (cards.length < 2) {
      return { message: 'Score submitted. Awaiting the second reviewer.' };
    }
    if (cards.length > 2) {
      throw new BadRequestException(
        'More than two submitted score cards exist for this application — data integrity issue',
      );
    }

    const [s1, s2] = cards;
    const variance = Math.abs(s1.compositePercentage - s2.compositePercentage);

    if (variance > VARIANCE_THRESHOLD) {
      // TC-SCO-04 — escalate to validator/lead evaluator, do NOT auto-average.
      // finalScorePercent stays null until the Lead Evaluator reconciles it
      // (ValidationService.resolveVariance).
      await this.applicationRepo.update(
        { id: applicationId },
        { scoreVarianceFlagged: true },
      );
      await this.stateMachine.transition(applicationId, {
        targetStatus: ApplicationStatus.PENDING_VALIDATION,
        actorId,
        role: 'ROLE_SCORING_REVIEWER',
        metadata: {
          reviewer1Score: s1.compositePercentage,
          reviewer2Score: s2.compositePercentage,
          variance,
        },
      });
      await this.auditLogService.record({
        actorId,
        actorRole: 'ROLE_SCORING_REVIEWER',
        action: 'SCORE_VARIANCE_ESCALATED',
        entityType: 'Application',
        entityId: applicationId,
        metadata: {
          reviewer1Score: s1.compositePercentage,
          reviewer2Score: s2.compositePercentage,
          variance,
        },
      });
      return {
        message:
          'Both scores submitted. Variance exceeds 15% — escalated for lead evaluator review.',
        variance,
      };
    }

    const averageScore =
      Math.round(
        ((s1.compositePercentage + s2.compositePercentage) / 2) * 100,
      ) / 100;

    if (averageScore >= QUALIFICATION_THRESHOLD) {
      await this.applicationRepo.update(
        { id: applicationId },
        { finalScorePercent: averageScore, scoreVarianceFlagged: false },
      );
      await this.stateMachine.transition(applicationId, {
        targetStatus: ApplicationStatus.SHORTLISTED,
        actorId,
        role: 'ROLE_SCORING_REVIEWER',
        metadata: {
          averageScore,
          reviewer1Score: s1.compositePercentage,
          reviewer2Score: s2.compositePercentage,
        },
      });
      await this.auditLogService.record({
        actorId,
        actorRole: 'ROLE_SCORING_REVIEWER',
        action: 'SCORE_FINALIZED_SHORTLISTED',
        entityType: 'Application',
        entityId: applicationId,
        metadata: { averageScore },
      });
      if (applicantEmail) {
        await this.notificationsService.sendShortlistedNotification(
          applicantEmail,
          averageScore,
        );
      }
      return {
        message: 'Both scores submitted and averaged. Application shortlisted.',
        averageScore,
      };
    }

    await this.applicationRepo.update(
      { id: applicationId },
      { finalScorePercent: averageScore, scoreVarianceFlagged: false },
    );
    await this.stateMachine.transition(applicationId, {
      targetStatus: ApplicationStatus.REJECTED,
      actorId,
      role: 'ROLE_SCORING_REVIEWER',
      metadata: {
        averageScore,
        reason: 'Below 70% qualification threshold',
      },
    });
    await this.auditLogService.record({
      actorId,
      actorRole: 'ROLE_SCORING_REVIEWER',
      action: 'SCORE_FINALIZED_REJECTED',
      entityType: 'Application',
      entityId: applicationId,
      metadata: { averageScore, reason: 'Below 70% qualification threshold' },
    });
    if (applicantEmail) {
      await this.notificationsService.sendDisqualificationNotification(
        applicantEmail,
        `Composite technical score of ${averageScore}% did not meet the 70% qualification threshold.`,
      );
    }

    return {
      message:
        'Both scores submitted. Application did not meet the qualification threshold.',
      averageScore,
    };
  }
}
