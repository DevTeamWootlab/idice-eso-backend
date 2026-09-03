// modules/scoring/scoring.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ApplicationsModule } from '@modules/applications/applications.module';
import { ScoreCard } from './entities/score-card.entity';
import { RubricConfiguration } from './entities/rubric-configuration.entity';
import { ScoringService } from './scoring.service';
import { ScoringController } from './scoring.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([ScoreCard, RubricConfiguration]),
    ApplicationsModule,
  ],
  controllers: [ScoringController],
  providers: [ScoringService],
})
export class ScoringModule {}
