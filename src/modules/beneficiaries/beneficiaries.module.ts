import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Beneficiary } from './entities/beneficiary.entity';
import { BeneficiarySkillsProfile } from './entities/beneficiary-skills-profile.entity';
import { BeneficiaryIncubationProfile } from './entities/beneficiary-incubation-profile.entity';
import { BeneficiaryAccelerationProfile } from './entities/beneficiary-acceleration-profile.entity';
import { Institution } from '@/modules/institutions/entities/institution.entity';

import { BeneficiariesController } from './beneficiaries.controller';
import { BeneficiariesService } from './beneficiaries.service';
import { GeoAllocationService } from './services/geo-allocation.service';

import { StorageModule } from '../storage/storage.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Beneficiary,
      BeneficiarySkillsProfile,
      BeneficiaryIncubationProfile,
      BeneficiaryAccelerationProfile,
      Institution,
    ]),
    StorageModule,
    NotificationsModule,
  ],
  controllers: [BeneficiariesController],
  providers: [BeneficiariesService, GeoAllocationService],
  exports: [BeneficiariesService],
})
export class BeneficiariesModule {}
