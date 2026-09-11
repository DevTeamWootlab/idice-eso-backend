import { Injectable, NotFoundException } from '@nestjs/common';
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

    const result = await this.applicationRepo.update(
      { id: applicationId },
      { status: targetStatus },
    );

    if (result.affected === 0) {
      throw new NotFoundException(
        `Application with ID '${applicationId}' not found`,
      );
    }

    // Placeholder for state machine guard validation, transition hooks, or audit log persistence
  }
}
