import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Application } from './entities/application.entity';
import { ApplicationStatus } from '@/common/enums/application-status.enum';

@Injectable()
export class ApplicationsStateMachineService {
  constructor(
    @InjectRepository(Application)
    private readonly applicationRepo: Repository<Application>,
  ) {}

  // real transition rules + guards go here — placeholder for now
  async transition(
    applicationId: string,
    to: ApplicationStatus,
  ): Promise<void> {
    await this.applicationRepo.update(applicationId, { status: to });
  }
}
