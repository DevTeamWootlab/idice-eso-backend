import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cohort } from './entities/cohort.entity';

@Injectable()
export class TrainingService {
  constructor(
    @InjectRepository(Cohort)
    private readonly cohortRepo: Repository<Cohort>,
  ) {}
}
