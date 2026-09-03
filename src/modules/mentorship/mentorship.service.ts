import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Mentor } from './entities/mentor.entity';

@Injectable()
export class MentorshipService {
  constructor(
    @InjectRepository(Mentor)
    private readonly mentorRepo: Repository<Mentor>,
  ) {}
}
