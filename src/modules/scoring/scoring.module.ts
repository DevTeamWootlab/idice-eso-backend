// modules/scoring/scoring.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ApplicationsModule } from '../applications/applications.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ScoreCard } from './entities/score-card.entity';
import { Application } from '../applications/entities/application.entity';
import { ReviewerAssignment } from '../applications/entities/reviewer-assignment.entity';
import { ScoringService } from './scoring.service';
import { ScoringController } from './scoring.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([ScoreCard, Application, ReviewerAssignment]),
    ApplicationsModule,
    NotificationsModule,
  ],
  controllers: [ScoringController],
  providers: [ScoringService],
})
export class ScoringModule {}
