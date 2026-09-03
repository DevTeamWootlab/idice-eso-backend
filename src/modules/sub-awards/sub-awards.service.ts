import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SubAward } from './entities/sub-award.entity';

@Injectable()
export class SubAwardsService {
  constructor(
    @InjectRepository(SubAward)
    private readonly subAwardRepo: Repository<SubAward>,
  ) {}
}
