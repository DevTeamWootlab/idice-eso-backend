// modules/eligibility/eligibility.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ApplicationsModule } from '@modules/applications/applications.module';
import { EligibilityChecklist } from './entities/eligibility-checklist.entity';
import { EligibilityCheckItem } from './entities/eligibility-check-item.entity';
import { EligibilityService } from './eligibility.service';
import { EligibilityController } from './eligibility.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([EligibilityChecklist, EligibilityCheckItem]),
    ApplicationsModule,
  ],
  controllers: [EligibilityController],
  providers: [EligibilityService],
})
export class EligibilityModule {}
