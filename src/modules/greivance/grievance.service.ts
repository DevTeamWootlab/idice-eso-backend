import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Grievance } from './entities/grievance.entity';

@Injectable()
export class GrievanceService {
  constructor(
    @InjectRepository(Grievance)
    private readonly grievanceRepo: Repository<Grievance>,
  ) {}
}
