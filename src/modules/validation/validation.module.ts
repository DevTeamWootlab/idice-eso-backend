import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ApplicationsModule } from '../applications/applications.module';
import { UsersModule } from '../users/users.module';
import { StorageModule } from '../storage/storage.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ValidationRecord } from './entities/validation-record.entity';
import { Application } from '../applications/entities/application.entity';
import { ScoreCard } from '../scoring/entities/score-card.entity';
import { ValidationService } from './validation.service';
import { ValidationController } from './validation.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([ValidationRecord, Application, ScoreCard]),
    ApplicationsModule,
    UsersModule,
    StorageModule,
    NotificationsModule,
  ],
  controllers: [ValidationController],
  providers: [ValidationService],
})
export class ValidationModule {}
