import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Application } from './entities/application.entity';
import { ApplicationStatus } from '@/common/enums/application.enum';

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

    const { targetStatus, actorId, role, metadata } = options;

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

    // Placeholder for state machine guard validation, transition hooks, or audit log persistence
  }
}
