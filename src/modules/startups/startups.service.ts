import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StartupMilestone } from './entities/startup-milestone.entity';

@Injectable()
export class StartupsService {
  constructor(
    @InjectRepository(StartupMilestone)
    private readonly milestoneRepo: Repository<StartupMilestone>,
  ) {}
}
