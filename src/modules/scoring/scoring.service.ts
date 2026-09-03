import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ScoreCard } from './entities/score-card.entity';
import { ApplicationsStateMachineService } from '@modules/applications/applications-state-machine.service';

@Injectable()
export class ScoringService {
  constructor(
    @InjectRepository(ScoreCard)
    private readonly scoreCardRepo: Repository<ScoreCard>,
    private readonly stateMachine: ApplicationsStateMachineService,
  ) {}
}
