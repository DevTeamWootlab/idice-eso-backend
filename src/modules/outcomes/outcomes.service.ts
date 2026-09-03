import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EmploymentOutcome } from './entities/employment-outcome.entity';

@Injectable()
export class OutcomesService {
  constructor(
    @InjectRepository(EmploymentOutcome)
    private readonly outcomeRepo: Repository<EmploymentOutcome>,
  ) {}
}
