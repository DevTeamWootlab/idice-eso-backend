import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ValidationRecord } from './entities/validation-record.entity';
import { ApplicationsStateMachineService } from '@modules/applications/applications-state-machine.service';

@Injectable()
export class ValidationService {
  constructor(
    @InjectRepository(ValidationRecord)
    private readonly validationRecordRepo: Repository<ValidationRecord>,
    private readonly stateMachine: ApplicationsStateMachineService,
  ) {}
}
