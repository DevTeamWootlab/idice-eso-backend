import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Institution } from '@/modules/institutions/entities/institution.entity';
import { StateOfNigeria } from '@/common/enums/beneficiary.enum';

@Injectable()
export class GeoAllocationService {
  constructor(
    @InjectRepository(Institution)
    private readonly institutionRepository: Repository<Institution>,
  ) {}

  /**
   * Resolves and assigns the optimal ESO host institution for an applicant
   */
  async allocateHub(
    preferredInstitutionId: string,
    stateOfResidence: StateOfNigeria,
  ): Promise<string> {
    // 1. Verify preferred institution existence & eligibility
    const preferred = await this.institutionRepository.findOne({
      where: { id: preferredInstitutionId, isActive: true },
    });

    if (preferred) {
      return preferred.id;
    }

    // 2. Fallback: Allocate to an active institution within the applicant's state of residence
    const fallbackInstitution = await this.institutionRepository.findOne({
      where: { state: stateOfResidence, isActive: true },
    });

    if (fallbackInstitution) {
      return fallbackInstitution.id;
    }

    // 3. Fallback: Return preferred ID if no fallback exists yet in DB
    return preferredInstitutionId;
  }
}
