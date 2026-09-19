import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StorageModule } from '../storage/storage.module';
import { UsersModule } from '../users/users.module';
import { Application } from './entities/application.entity';
import { ApplicationPersonnel } from './entities/application-personnel.entity';
import { ApplicationReference } from './entities/application-reference.entity';
import { ApplicationDocument } from './entities/application-document.entity';
import { ReviewerAssignment } from './entities/reviewer-assignment.entity';
import { ApplicationsService } from './applications.service';
import { ApplicationsStateMachineService } from './applications-state-machine.service';
import { ApplicationCompletenessService } from './application-completeness.service';
import { ApplicationsController } from './applications.controller';
import { AdminApplicationsController } from './admin-applications.controller';
import { InternalApplicationAccessController } from './internal-application-access.controller';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Application,
      ApplicationPersonnel,
      ApplicationReference,
      ApplicationDocument,
      ReviewerAssignment,
    ]),
    StorageModule,
    UsersModule,
    NotificationsModule,
  ],
  controllers: [
    ApplicationsController,
    AdminApplicationsController,
    InternalApplicationAccessController,
  ],
  providers: [
    ApplicationsService,
    ApplicationsStateMachineService,
    ApplicationCompletenessService,
  ],
  exports: [ApplicationsStateMachineService],
})
export class ApplicationsModule {}
