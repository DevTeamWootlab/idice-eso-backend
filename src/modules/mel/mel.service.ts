import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MELKpiSnapshot } from './entities/mel-kpi-snapshot.entity';

@Injectable()
export class MelService {
  constructor(
    @InjectRepository(MELKpiSnapshot)
    private readonly snapshotRepo: Repository<MELKpiSnapshot>,
  ) {}
}
