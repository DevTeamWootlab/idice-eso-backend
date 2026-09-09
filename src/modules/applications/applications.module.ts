// modules/applications/applications.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Application } from './entities/application.entity';
import { ApplicationPersonnel } from './entities/application-personnel.entity';
import { ApplicationReference } from './entities/application-reference.entity';
import { ApplicationDocument } from './entities/application-document.entity';
import { ApplicationsService } from './applications.service';
import { ApplicationsStateMachineService } from './applications-state-machine.service';
import { ApplicationsController } from './applications.controller';
import { ApplicationCompletenessService } from './application-completeness.service';
import { StorageModule } from '@/modules/storage/storage.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Application,
      ApplicationPersonnel,

      ApplicationReference,
      ApplicationDocument,
    ]),
    StorageModule,
  ],
  controllers: [ApplicationsController],
  providers: [
    ApplicationsService,
    ApplicationsStateMachineService,
    ApplicationCompletenessService,
  ],
  exports: [ApplicationsService, ApplicationsStateMachineService],
})
export class ApplicationsModule {}
