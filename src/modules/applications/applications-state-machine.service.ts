import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Application } from './entities/application.entity';
import { Institution } from '@/modules/institutions/entities/institution.entity';
import { NotificationsService } from '@/modules/notifications/notifications.service';
import { ApplicationStatus } from '@/common/enums/application.enum';
import { Role } from '@/common/enums/role.enum';
import { applicationLabel } from './application-label';

export interface TransitionOptions {
  targetStatus: ApplicationStatus;
  actorId?: string;
  role?: string;
  metadata?: Record<string, any>;
}

const ALLOWED_TRANSITIONS: Record<ApplicationStatus, ApplicationStatus[]> = {
  [ApplicationStatus.DRAFT]: [ApplicationStatus.SUBMITTED],
  [ApplicationStatus.SUBMITTED]: [
    ApplicationStatus.IN_REVIEW_ELIGIBILITY,
    ApplicationStatus.REJECTED,
  ],
  [ApplicationStatus.IN_REVIEW_ELIGIBILITY]: [
    ApplicationStatus.IN_REVIEW_SCORING,
    ApplicationStatus.REWORK_REQUIRED,
    ApplicationStatus.REJECTED,
  ],
  [ApplicationStatus.REWORK_REQUIRED]: [ApplicationStatus.SUBMITTED],
  [ApplicationStatus.IN_REVIEW_SCORING]: [
    ApplicationStatus.PENDING_VALIDATION,
    ApplicationStatus.SHORTLISTED,
    ApplicationStatus.REJECTED,
  ],
  [ApplicationStatus.PENDING_VALIDATION]: [
    ApplicationStatus.SHORTLISTED,
    ApplicationStatus.REJECTED,
  ],
  [ApplicationStatus.SHORTLISTED]: [
    ApplicationStatus.PENDING_ECOSYSTEM_VALIDATION,
    ApplicationStatus.VALIDATED_SHORTLISTED,
    ApplicationStatus.REJECTED,
  ],
  [ApplicationStatus.PENDING_CONTEXTUAL_FEEDBACK]: [
    ApplicationStatus.PENDING_ECOSYSTEM_VALIDATION,
    ApplicationStatus.REJECTED,
  ],
  [ApplicationStatus.PENDING_ECOSYSTEM_VALIDATION]: [
    ApplicationStatus.VALIDATED_SHORTLISTED,
    ApplicationStatus.REJECTED,
  ],
  [ApplicationStatus.VALIDATED_SHORTLISTED]: [
    ApplicationStatus.MATCHED,
    ApplicationStatus.REJECTED,
  ],
  [ApplicationStatus.MATCHED]: [],
  [ApplicationStatus.REJECTED]: [],
};

@Injectable()
export class ApplicationsStateMachineService {
  constructor(
    @InjectRepository(Application)
    private readonly applicationRepo: Repository<Application>,
    private readonly notificationsService: NotificationsService,
  ) {}

  /**
   * Transitions an application to a new state with audit context.
   * Supports both direct ApplicationStatus enum values and full TransitionOptions context objects.
   */
  async transition(
    applicationId: string,
    target: ApplicationStatus | TransitionOptions,
  ): Promise<void> {
    const options: TransitionOptions =
      typeof target === 'string' ? { targetStatus: target } : target;

    const { targetStatus } = options;

    const application = await this.applicationRepo.findOne({
      where: { id: applicationId },
    });

    if (!application) {
      throw new NotFoundException(
        `Application with ID '${applicationId}' not found`,
      );
    }

    const allowedNextStates = ALLOWED_TRANSITIONS[application.status] ?? [];
    if (!allowedNextStates.includes(targetStatus)) {
      throw new BadRequestException(
        `Invalid application transition from ${application.status} to ${targetStatus}`,
      );
    }

    await this.applicationRepo.update(
      { id: applicationId },
      { status: targetStatus },
    );

    await this.announceQueueEntry(application, targetStatus);
  }

  async applyScoringCorrection(
    applicationId: string,
    targetStatus: ApplicationStatus.SHORTLISTED | ApplicationStatus.PENDING_VALIDATION,
  ): Promise<void> {
    const application = await this.applicationRepo.findOne({ where: { id: applicationId } });
    if (!application) {
      throw new NotFoundException(`Application with ID '${applicationId}' not found`);
    }
    if (application.status !== ApplicationStatus.REJECTED) {
      throw new BadRequestException(
        `Scoring corrections only apply to rejected applications; this one is ${application.status}`,
      );
    }
    await this.applicationRepo.update({ id: applicationId }, { status: targetStatus });
    await this.announceQueueEntry(application, targetStatus);
  }

  /**
   * Tells the people whose queue an application just entered. Best-effort: a failed
   * notification must never fail or roll back the transition itself.
   */
  private async announceQueueEntry(application: Application, target: ApplicationStatus) {
    try {
      const label = applicationLabel(application);
      const href = `/internal/applications/${application.id}`;
      const notify = this.notificationsService;
      const validatorState = async () => {
        if (!application.preferredInstitutionId) return undefined;
        const institution = await this.applicationRepo.manager
          .getRepository(Institution)
          .findOne({ where: { id: application.preferredInstitutionId } });
        return institution?.state;
      };

      switch (target) {
        case ApplicationStatus.SUBMITTED:
          await notify.notifyRole(Role.ELIGIBILITY_REVIEWER, 'New application to review', `${label} is waiting in the eligibility queue.`, href);
          break;
        case ApplicationStatus.IN_REVIEW_SCORING:
          await notify.notifyRole(Role.SYSADMIN, 'Application ready for scoring', `${label} passed eligibility. Assign Reviewer 1 and Reviewer 2 to begin scoring.`, href);
          break;
        case ApplicationStatus.PENDING_VALIDATION: {
          const state = await validatorState();
          if (state) await notify.notifyRole(Role.VALIDATOR, 'Score variance escalated', `The two scoring reviewers' results for ${label} differ by more than 15 points. It needs your review.`, href, { state });
          break;
        }
        case ApplicationStatus.SHORTLISTED:
        case ApplicationStatus.PENDING_ECOSYSTEM_VALIDATION: {
          const state = await validatorState();
          if (state) await notify.notifyRole(Role.VALIDATOR, 'Application awaiting field validation', `${label} is in your validation queue.`, href, { state });
          break;
        }
        case ApplicationStatus.VALIDATED_SHORTLISTED:
          await notify.notifyRole(Role.SYSADMIN, 'Application ready for matching', `${label} has been validated and can be included in the next match run.`, '/internal/match-engine');
          break;
        default:
          break;
      }
    } catch {
      // Notifications are advisory.
    }
  }
}
