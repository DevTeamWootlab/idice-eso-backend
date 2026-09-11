import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ApplicationsModule } from '../applications/applications.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { EligibilityChecklist } from './entities/eligibility-checklist.entity';
import { EligibilityCheckItem } from './entities/eligibility-check-item.entity';
import { Application } from '../applications/entities/application.entity';
import { EligibilityService } from './eligibility.service';
import { EligibilityController } from './eligibility.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      EligibilityChecklist,
      EligibilityCheckItem,
      Application,
    ]),
    ApplicationsModule,
    NotificationsModule,
  ],
  controllers: [EligibilityController],
  providers: [EligibilityService],
})
export class EligibilityModule {}
