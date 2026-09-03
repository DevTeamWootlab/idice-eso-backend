// modules/beneficiaries/beneficiaries.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Beneficiary } from './entities/beneficiary.entity';
import { BeneficiarySkillsProfile } from './entities/beneficiary-skills-profile.entity';
import { BeneficiaryIncubationProfile } from './entities/beneficiary-incubation-profile.entity';
import { BeneficiaryAccelerationProfile } from './entities/beneficiary-acceleration-profile.entity';
import { BeneficiariesService } from './beneficiaries.service';
import { BeneficiariesController } from './beneficiaries.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Beneficiary,
      BeneficiarySkillsProfile,
      BeneficiaryIncubationProfile,
      BeneficiaryAccelerationProfile,
    ]),
  ],
  controllers: [BeneficiariesController],
  providers: [BeneficiariesService],
})
export class BeneficiariesModule {}
