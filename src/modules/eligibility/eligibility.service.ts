import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EligibilityChecklist } from './entities/eligibility-checklist.entity';
import { EligibilityCheckItem } from './entities/eligibility-check-item.entity';
import { ApplicationsStateMachineService } from '@modules/applications/applications-state-machine.service';

@Injectable()
export class EligibilityService {
  constructor(
    @InjectRepository(EligibilityChecklist)
    private readonly checklistRepo: Repository<EligibilityChecklist>,
    @InjectRepository(EligibilityCheckItem)
    private readonly checkItemRepo: Repository<EligibilityCheckItem>,
    private readonly stateMachine: ApplicationsStateMachineService,
  ) {}
}
