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
import { RubricConfiguration } from './entities/rubric-configuration.entity';
import { ScoringSettingsController } from './scoring-settings.controller';
import { ScoringIntegrityController } from './scoring-integrity.controller';
import { ScoringIntegrityService } from './scoring-integrity.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ScoreCard,
      Application,
      ReviewerAssignment,
      RubricConfiguration,
    ]),
    ApplicationsModule,
    NotificationsModule,
  ],
  controllers: [ScoringController, ScoringSettingsController, ScoringIntegrityController],
  providers: [ScoringService, ScoringIntegrityService],
})
export class ScoringModule {}
