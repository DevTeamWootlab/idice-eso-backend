import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Beneficiary } from './entities/beneficiary.entity';
import { BeneficiarySkillsProfile } from './entities/beneficiary-skills-profile.entity';
import { BeneficiaryIncubationProfile } from './entities/beneficiary-incubation-profile.entity';
import { BeneficiaryAccelerationProfile } from './entities/beneficiary-acceleration-profile.entity';

@Injectable()
export class BeneficiariesService {
  constructor(
    @InjectRepository(Beneficiary)
    private readonly beneficiaryRepo: Repository<Beneficiary>,
    @InjectRepository(BeneficiarySkillsProfile)
    private readonly skillsProfileRepo: Repository<BeneficiarySkillsProfile>,
    @InjectRepository(BeneficiaryIncubationProfile)
    private readonly incubationProfileRepo: Repository<BeneficiaryIncubationProfile>,
    @InjectRepository(BeneficiaryAccelerationProfile)
    private readonly accelerationProfileRepo: Repository<BeneficiaryAccelerationProfile>,
  ) {}
}
