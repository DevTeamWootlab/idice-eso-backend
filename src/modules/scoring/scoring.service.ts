// modules/scoring/scoring.service.ts
import { BadRequestException, ForbiddenException, Injectable, NotFoundException, ConflictException, InternalServerErrorException } from '@nestjs/common';
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
import { ReviseScoreDto, SubmitScoreDto } from './dto/submit-score.dto';
import { AuditLogService } from '@/modules/audit-log/audit-log.service';
import { NotificationsService } from '@/modules/notifications/notifications.service';
import { RUBRIC_DIMENSIONS, compositePercent, resolveWeights, validateWeightsInput, RubricWeights, toValidPercent, averageOfPercents } from './scoring-weights';
import { Role } from '@/common/enums/role.enum';
import { applicationLabel } from '../applications/application-label';
import { User } from '@/modules/users/entities/user.entity';
import { Match, MatchStatus } from '@/modules/matching/entities/match.entity';

import {
  PaginationQueryDto,
  PaginatedResult,
} from '../../common/dto/pagination-query.dto';

const VARIANCE_THRESHOLD = 15; // percentage points
const QUALIFICATION_THRESHOLD = 70.0; // percent

const SCORE_FIELDS = [
  'localPresenceScore',
  'teamExpertiseScore',
  'incubationExperienceScore',
  'credibilityGovernanceScore',
  'deliveryTrackRecordScore',
  'institutionalAlignmentScore',
] as const;

const REVISABLE_STATUSES: ApplicationStatus[] = [
  ApplicationStatus.IN_REVIEW_SCORING,
  ApplicationStatus.PENDING_VALIDATION,
  ApplicationStatus.SHORTLISTED,
  ApplicationStatus.PENDING_ECOSYSTEM_VALIDATION,
  ApplicationStatus.VALIDATED_SHORTLISTED,
  ApplicationStatus.REJECTED,
];

const SHORTLIST_STAGE: ApplicationStatus[] = [
  ApplicationStatus.SHORTLISTED,
  ApplicationStatus.PENDING_ECOSYSTEM_VALIDATION,
  ApplicationStatus.VALIDATED_SHORTLISTED,
];

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

  async getSubmittedByMe(reviewerId: string) {
    const cards = await this.scoreCardRepo.find({
      where: { reviewerId, submitted: true },
      relations: { application: true },
      order: { submittedAt: 'DESC' },
    });
    return cards
      .filter((card) => !!card.application)
      .map((card) => {
        const application = card.application;
        const finalized =
          application.status !== ApplicationStatus.IN_REVIEW_SCORING;
        return {
          applicationId: application.id,
          applicationRef: application.applicationRef,
          organisationName: application.organisationLegalName ?? null,
          status: application.status,
          myScorePercent: toValidPercent(card.compositePercentage),
          mySubmittedAt: card.submittedAt ?? null,
          reviewerSlot: card.reviewerSlot ?? null,
          finalScorePercent: finalized
            ? toValidPercent(application.finalScorePercent)
            : null,
          finalScorePublished:
            finalized && toValidPercent(application.finalScorePercent) !== null,
          awaitingCoReviewer: !finalized,
        };
      });
  }

  /**
   * GET /internal/applications/queue/scoring/completed
   * Every application this reviewer has already submitted a score for.
   * Only their own score is returned — never the other reviewer's card,
   * even after both have submitted, keeping this consistent with the
   * blind dual-review concealment rule enforced elsewhere in scoring.
   */
  async getCompletedQueue(
    reviewerId: string,
    pagination: PaginationQueryDto,
  ): Promise<PaginatedResult<any>> {
    const page = pagination.page ?? 1;
    const limit = pagination.limit ?? 20;

    const [cards, total] = await this.scoreCardRepo.findAndCount({
      where: {
        reviewerId,
        submitted: true,
      },
      relations: {
        application: true,
      },
      order: {
        submittedAt: 'DESC',
      },
      skip: (page - 1) * limit,
      take: limit,
    });

    const data = cards
      .filter((card) => !!card.application)
      .map((card) => {
        const application = card.application;
        const finalized =
          application.status !== ApplicationStatus.IN_REVIEW_SCORING;
        const finalScore = finalized
          ? toValidPercent(application.finalScorePercent)
          : null;

        return {
          applicationId: application.id,
          applicationRef: application.applicationRef,
          organisationName: application.organisationLegalName ?? null,
          status: application.status,
          myScorePercent: toValidPercent(card.compositePercentage),
          mySubmittedAt: card.submittedAt ?? null,
          reviewerSlot: card.reviewerSlot ?? null,
          finalScorePercent: finalScore,
          finalScorePublished: finalized && finalScore !== null,
          awaitingCoReviewer: !finalized,
        };
      });

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
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
    const compositePercentage = toValidPercent(
      this.calculateComposite(dto, weights),
    );
    if (compositePercentage === null) {
      throw new BadRequestException(
        'The composite score could not be calculated from the submitted dimension scores. Check that all six dimensions have a score between 0 and 5.',
      );
    }
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
        reviewerSlot:
          (await this.reviewerSlotOf(reviewerId)) ?? existingCount + 1,
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
    for (const other of counterparts.filter(
      (a) => a.reviewerId !== reviewerId && !a.completed,
    )) {
      await this.notificationsService.notifyUser(
        other.reviewerId,
        'Your counterpart has submitted their score',
        `The other scoring reviewer has scored ${applicationLabel(application)}. Submit your score to complete scoring.`,
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

    return this.tryFinalize(
      applicationId,
      reviewerId,
      application.primaryContactEmail,
    );
  }

  async getRevisionState(applicationId: string, reviewerId: string) {
    await this.assertAssigned(applicationId, reviewerId);
    const application = await this.applicationRepo.findOne({
      where: { id: applicationId },
      select: { id: true, status: true },
    });
    if (!application) throw new NotFoundException('Application not found');
    const card = await this.scoreCardRepo.findOne({ where: { applicationId, reviewerId } });
    const submittedCount = await this.scoreCardRepo.count({ where: { applicationId, submitted: true } });
    const problem = this.revisionProblem(application.status, !!card?.submitted, submittedCount);
    return { canRevise: problem === null, reason: problem, status: application.status };
  }

  private revisionProblem(status: ApplicationStatus, hasSubmitted: boolean, submittedCount: number): string | null {
    if (!hasSubmitted) return 'You have not submitted a score for this application yet.';
    if (status === ApplicationStatus.MATCHED) {
      return 'This application has already been matched to a Centre of Excellence, so its scores are locked.';
    }
    if (!REVISABLE_STATUSES.includes(status)) {
      return `This application is ${status} and its scores can no longer be changed.`;
    }
    if (status === ApplicationStatus.REJECTED && submittedCount < 2) {
      return 'This application was not rejected at the scoring stage, so there is no score to revise.';
    }
    return null;
  }

  async reviseScore(applicationId: string, reviewerId: string, dto: ReviseScoreDto) {
    const assignment = await this.assertAssigned(applicationId, reviewerId);
    const application = await this.applicationRepo.findOne({ where: { id: applicationId } });
    if (!application) throw new NotFoundException('Application not found');

    const card = await this.scoreCardRepo.findOne({ where: { applicationId, reviewerId } });
    const submittedCards = await this.scoreCardRepo.find({ where: { applicationId, submitted: true } });
    const problem = this.revisionProblem(application.status, !!card?.submitted, submittedCards.length);
    if (problem || !card) throw new BadRequestException(problem ?? 'Score card not found');

    const reason = (dto.reason ?? '').trim();
    if (reason.length < 10) {
      throw new BadRequestException('Explain the change in at least 10 characters');
    }

    const weights = await this.loadWeights();
    const compositePercentage = toValidPercent(this.calculateComposite(dto, weights));
    if (compositePercentage === null) {
      throw new BadRequestException(
        'The composite score could not be calculated from the revised dimension scores. Check that all six dimensions have a score between 0 and 5.',
      );
    }

    const before = {
      ...Object.fromEntries(SCORE_FIELDS.map((field) => [field, Number(card[field])])),
      comments: card.comments ?? null,
      compositePercentage: toValidPercent(card.compositePercentage),
    };
    const nextComments = dto.comments === undefined ? (card.comments ?? null) : dto.comments || null;
    const unchanged =
      SCORE_FIELDS.every((field) => Number(card[field]) === Number(dto[field])) &&
      (card.comments ?? null) === nextComments;
    if (unchanged) {
      throw new BadRequestException('The revised score is the same as the one already submitted');
    }

    const other = submittedCards.find((c) => c.id !== card.id) ?? null;
    if (other && application.status === ApplicationStatus.VALIDATED_SHORTLISTED) {
      const otherScore = toValidPercent(other.compositePercentage);
      if (otherScore !== null && Math.abs(otherScore - compositePercentage) > VARIANCE_THRESHOLD) {
        throw new BadRequestException(
          `This application has already passed field validation. The revised score would differ from the other reviewer's by more than ${VARIANCE_THRESHOLD} points, which would need a fresh reconciliation. Keep the two scores within ${VARIANCE_THRESHOLD} points or ask the administrator to review it.`,
        );
      }
    }

    for (const field of SCORE_FIELDS) card[field] = dto[field];
    card.comments = nextComments as string;
    card.compositePercentage = compositePercentage;
    card.submitted = true;
    await this.scoreCardRepo.save(card);
    if (!assignment.completed) {
      assignment.completed = true;
      await this.assignmentRepo.save(assignment);
    }

    await this.auditLogService.record({
      actorId: reviewerId,
      actorRole: 'ROLE_SCORING_REVIEWER',
      action: 'SCORE_REVISED',
      entityType: 'Application',
      entityId: applicationId,
      metadata: other
        ? {
            reviewerSlot: card.reviewerSlot,
            reason,
            statusBefore: application.status,
            before,
            after: {
              ...Object.fromEntries(SCORE_FIELDS.map((field) => [field, Number(dto[field])])),
              comments: nextComments,
              compositePercentage,
            },
          }
        : { reviewerSlot: card.reviewerSlot, reason, statusBefore: application.status },
    });

    if (!other) {
      return { message: 'Your revised score is saved. Awaiting the second reviewer.', status: application.status };
    }
    if (application.status === ApplicationStatus.IN_REVIEW_SCORING) {
      return this.tryFinalize(applicationId, reviewerId, application.primaryContactEmail);
    }
    return this.applyRevisedOutcome(application, card, other, reviewerId, reason);
  }

  private async applyRevisedOutcome(
    application: Application,
    mine: ScoreCard,
    other: ScoreCard,
    actorId: string,
    reason: string,
  ) {
    const applicationId = application.id;
    const [first, second] = [mine, other].sort((a, b) => (a.reviewerSlot ?? 0) - (b.reviewerSlot ?? 0));
    const r1 = toValidPercent(first.compositePercentage);
    const r2 = toValidPercent(second.compositePercentage);
    if (r1 === null || r2 === null) {
      return this.blockFinalization(applicationId, actorId, 'A submitted score card has a missing or invalid composite percentage.', {
        reviewer1Score: String(first.compositePercentage),
        reviewer2Score: String(second.compositePercentage),
      });
    }
    const variance = Math.round(Math.abs(r1 - r2) * 100) / 100;
    const statusBefore = application.status;
    const label = applicationLabel(application);
    const href = `/internal/applications/${applicationId}`;

    if (variance > VARIANCE_THRESHOLD) {
      await this.applicationRepo.update(
        { id: applicationId },
        { finalScorePercent: null, scoreVarianceFlagged: true, scoringIntegrityError: null },
      );
      await this.stateMachine.applyScoreRevision(applicationId, ApplicationStatus.PENDING_VALIDATION);
      await this.auditLogService.record({
        actorId,
        actorRole: 'ROLE_SCORING_REVIEWER',
        action: 'SCORE_VARIANCE_ESCALATED',
        entityType: 'Application',
        entityId: applicationId,
        metadata: { reviewer1Score: r1, reviewer2Score: r2, variance, revised: true, statusBefore },
      });
      if (statusBefore !== ApplicationStatus.PENDING_VALIDATION) {
        await this.notificationsService.notifyRole(
          Role.SYSADMIN,
          'Revised score sent for reconciliation',
          `${label}: a reviewer revised their score and the two scores now differ by ${variance} points. It has moved to the validator for reconciliation.`,
          href,
        );
      }
      return {
        message: `Revised score saved. The two scores now differ by more than ${VARIANCE_THRESHOLD} points, so the application has gone to the Lead Evaluator for reconciliation.`,
        variance,
        status: ApplicationStatus.PENDING_VALIDATION,
      };
    }

    const averageScore = averageOfPercents(r1, r2);
    if (averageScore === null) {
      return this.blockFinalization(applicationId, actorId, 'The average of the two composite scores could not be calculated.', {
        reviewer1Score: r1,
        reviewer2Score: r2,
      });
    }

    if (averageScore >= QUALIFICATION_THRESHOLD) {
      await this.applicationRepo.update(
        { id: applicationId },
        { finalScorePercent: averageScore, scoreVarianceFlagged: false, scoringIntegrityError: null },
      );
      const moved = !SHORTLIST_STAGE.includes(statusBefore);
      if (moved) await this.stateMachine.applyScoreRevision(applicationId, ApplicationStatus.SHORTLISTED);
      if (statusBefore === ApplicationStatus.VALIDATED_SHORTLISTED) {
        await this.applicationRepo.manager
          .getRepository(Match)
          .delete({ applicationId, status: MatchStatus.GENERATED });
      }
      await this.auditLogService.record({
        actorId,
        actorRole: 'ROLE_SCORING_REVIEWER',
        action: 'SCORE_FINALIZED_SHORTLISTED',
        entityType: 'Application',
        entityId: applicationId,
        metadata: { averageScore, reviewer1Score: r1, reviewer2Score: r2, revised: true, statusBefore, reason },
      });
      if (moved) {
        if (application.primaryContactEmail) {
          await this.notificationsService.sendShortlistedNotification(
            application.primaryContactEmail,
            averageScore,
            application.applicationRef,
          );
        }
        await this.notificationsService.notifyRole(
          Role.SYSADMIN,
          'Revised score shortlisted an application',
          `${label} was ${statusBefore === ApplicationStatus.REJECTED ? 'rejected' : 'awaiting reconciliation'} and is now shortlisted at ${averageScore}% after a reviewer revised their score.`,
          href,
        );
      }
      return {
        message: moved
          ? `Revised score saved. The new average is ${averageScore}%, so the application is now shortlisted and goes to field validation.`
          : statusBefore === ApplicationStatus.VALIDATED_SHORTLISTED
            ? `Revised score saved. The new average is ${averageScore}% and the application stays shortlisted. Any match proposed for it was cleared, so run matching again before approving.`
            : `Revised score saved. The new average is ${averageScore}% and the application stays shortlisted.`,
        averageScore,
        status: moved ? ApplicationStatus.SHORTLISTED : statusBefore,
      };
    }

    await this.applicationRepo.update(
      { id: applicationId },
      { finalScorePercent: averageScore, scoreVarianceFlagged: false, scoringIntegrityError: null },
    );
    const moved = statusBefore !== ApplicationStatus.REJECTED;
    if (moved) {
      await this.stateMachine.applyScoreRevision(applicationId, ApplicationStatus.REJECTED);
      await this.applicationRepo.manager
        .getRepository(Match)
        .delete({ applicationId, status: MatchStatus.GENERATED });
    }
    await this.auditLogService.record({
      actorId,
      actorRole: 'ROLE_SCORING_REVIEWER',
      action: 'SCORE_FINALIZED_REJECTED',
      entityType: 'Application',
      entityId: applicationId,
      metadata: { averageScore, reason: 'Below 70% qualification threshold', revised: true, statusBefore, revisionReason: reason },
    });
    if (moved) {
      if (application.primaryContactEmail) {
        await this.notificationsService.sendDisqualificationNotification(
          application.primaryContactEmail,
          `Composite technical score of ${averageScore}% did not meet the 70% qualification threshold.`,
          application.applicationRef,
        );
      }
      await this.notificationsService.notifyRole(
        Role.SYSADMIN,
        'Revised score rejected an application',
        `${label} dropped to ${averageScore}% after a reviewer revised their score and is now rejected.`,
        href,
      );
    }
    return {
      message: moved
        ? `Revised score saved. The new average is ${averageScore}%, below the 70% threshold, so the application is now rejected.`
        : `Revised score saved. The new average is ${averageScore}%, still below the 70% threshold.`,
      averageScore,
      status: ApplicationStatus.REJECTED,
    };
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

    await this.rubricRepo.manager.transaction(
      async (manager: EntityManager) => {
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
      },
    );

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
    const r1 = toValidPercent(s1.compositePercentage);
    const r2 = toValidPercent(s2.compositePercentage);
    if (r1 === null || r2 === null) {
      return this.blockFinalization(
        applicationId,
        actorId,
        'A submitted score card has a missing or invalid composite percentage.',
        {
          reviewer1Score: String(s1.compositePercentage),
          reviewer2Score: String(s2.compositePercentage),
        },
      );
    }
    const variance = Math.round(Math.abs(r1 - r2) * 100) / 100;

    if (variance > VARIANCE_THRESHOLD) {
      // TC-SCO-04 — escalate to validator/lead evaluator, do NOT auto-average.
      // finalScorePercent stays null until the Lead Evaluator reconciles it
      // (ValidationService.resolveVariance).
      await this.applicationRepo.update(
        { id: applicationId },
        { scoreVarianceFlagged: true, scoringIntegrityError: null },
      );
      await this.stateMachine.transition(applicationId, {
        targetStatus: ApplicationStatus.PENDING_VALIDATION,
        actorId,
        role: 'ROLE_SCORING_REVIEWER',
        metadata: {
          reviewer1Score: r1,
          reviewer2Score: r2,
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
          reviewer1Score: r1,
          reviewer2Score: r2,
          variance,
        },
      });
      return {
        message:
          'Both scores submitted. Variance exceeds 15% — escalated for lead evaluator review.',
        variance,
      };
    }

    const averageScore = averageOfPercents(r1, r2);
    if (averageScore === null) {
      return this.blockFinalization(
        applicationId,
        actorId,
        'The average of the two composite scores could not be calculated.',
        { reviewer1Score: r1, reviewer2Score: r2 },
      );
    }

    if (averageScore >= QUALIFICATION_THRESHOLD) {
      await this.applicationRepo.update(
        { id: applicationId },
        {
          finalScorePercent: averageScore,
          scoreVarianceFlagged: false,
          scoringIntegrityError: null,
        },
      );
      await this.stateMachine.transition(applicationId, {
        targetStatus: ApplicationStatus.SHORTLISTED,
        actorId,
        role: 'ROLE_SCORING_REVIEWER',
        metadata: {
          averageScore,
          reviewer1Score: r1,
          reviewer2Score: r2,
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
          await this.refOf(applicationId),
        );
      }
      return {
        message: 'Both scores submitted and averaged. Application shortlisted.',
        averageScore,
      };
    }

    if (!(averageScore < QUALIFICATION_THRESHOLD)) {
      throw new InternalServerErrorException(
        'Score finalization reached an undefined outcome',
      );
    }
    await this.applicationRepo.update(
      { id: applicationId },
      {
        finalScorePercent: averageScore,
        scoreVarianceFlagged: false,
        scoringIntegrityError: null,
      },
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
        await this.refOf(applicationId),
      );
    }

    return {
      message:
        'Both scores submitted. Application did not meet the qualification threshold.',
      averageScore,
    };
  }

  private async refOf(applicationId: string): Promise<string | undefined> {
    const row = await this.applicationRepo.findOne({
      where: { id: applicationId },
      select: { id: true, applicationRef: true },
    });
    return row?.applicationRef;
  }

  private async blockFinalization(
    applicationId: string,
    actorId: string,
    reason: string,
    metadata: Record<string, unknown>,
  ) {
    const application = await this.applicationRepo.findOne({
      where: { id: applicationId },
    });
    await this.applicationRepo.update(
      { id: applicationId },
      { scoringIntegrityError: reason },
    );
    await this.auditLogService.record({
      actorId,
      actorRole: 'ROLE_SCORING_REVIEWER',
      action: 'SCORE_FINALIZATION_BLOCKED',
      entityType: 'Application',
      entityId: applicationId,
      metadata: { reason, ...metadata },
    });
    await this.notificationsService.notifyRole(
      Role.SYSADMIN,
      'Scoring on hold: invalid score',
      `${applicationLabel(application ?? { id: applicationId })}: both scores are in, but the final score could not be calculated. The application has not been shortlisted or rejected. Open it to review the score cards and re-run finalization.`,
      `/internal/applications/${applicationId}`,
    );
    return {
      message:
        'Score submitted. Final scoring is on hold because the combined score could not be calculated; a System Administrator has been notified.',
      blocked: true,
    };
  }

  async refinalize(applicationId: string, actor: JwtPayload) {
    const application = await this.applicationRepo.findOne({
      where: { id: applicationId },
    });
    if (!application) throw new NotFoundException('Application not found');
    if (application.status !== ApplicationStatus.IN_REVIEW_SCORING) {
      throw new BadRequestException(
        `Application is in ${application.status} status; only applications still in scoring can be re-finalized`,
      );
    }
    await this.auditLogService.record({
      actorId: actor.sub,
      actorRole: actor.role,
      action: 'SCORE_FINALIZATION_RETRIED',
      entityType: 'Application',
      entityId: applicationId,
      metadata: { previousError: application.scoringIntegrityError ?? null },
    });
    return this.tryFinalize(
      applicationId,
      actor.sub,
      application.primaryContactEmail,
    );
  }
}
