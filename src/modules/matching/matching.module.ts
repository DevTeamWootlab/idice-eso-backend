// modules/matching/matching.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Match } from './entities/match.entity';
import { MatchingService } from './matching.service';
import { MatchingController } from './matching.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Match])],
  controllers: [MatchingController],
  providers: [MatchingService],
})
export class MatchingModule {}
