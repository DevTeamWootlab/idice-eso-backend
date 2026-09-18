// modules/matching/matching.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Match } from './entities/match.entity';
import { Application } from '@/modules/applications/entities/application.entity';
import { Institution } from '@/modules/institutions/entities/institution.entity';
import { ApplicationsModule } from '@/modules/applications/applications.module';
import { NotificationsModule } from '@/modules/notifications/notifications.module';
import { MatchingService } from './matching.service';
import { MatchingController } from './matching.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Match, Application, Institution]),
    ApplicationsModule,
    NotificationsModule,
  ],
  controllers: [MatchingController],
  providers: [MatchingService],
})
export class MatchingModule {}
