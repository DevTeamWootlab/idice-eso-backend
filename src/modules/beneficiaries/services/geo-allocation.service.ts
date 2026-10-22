import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Institution } from '@/modules/institutions/entities/institution.entity';
import { StateOfNigeria } from '@/common/enums/beneficiary.enum';
import { hubsShareCourses, sameState } from '../hub-compatibility';

@Injectable()
export class GeoAllocationService {
  constructor(
    @InjectRepository(Institution)
    private readonly institutionRepository: Repository<Institution>,
  ) {}

  async allocateHub(
    preferredInstitutionId: string,
    stateOfResidence: StateOfNigeria,
    requiredHubType?: string | null,
  ): Promise<Institution> {
    const preferred = await this.institutionRepository.findOne({
      where: { id: preferredInstitutionId, isActive: true },
    });
    if (preferred) {
      if (requiredHubType && !hubsShareCourses(preferred.hubType, requiredHubType)) {
        throw new BadRequestException(
          `${preferred.name} does not run the course you selected. Go back, choose the Centre of Excellence again and pick a course from its list.`,
        );
      }
      return preferred;
    }

    const active = await this.institutionRepository.find({
      where: { isActive: true },
      order: { name: 'ASC' },
    });
    const inState = active.filter((institution) => sameState(institution.state, stateOfResidence));
    const fallback = requiredHubType
      ? inState.find((institution) => hubsShareCourses(institution.hubType, requiredHubType))
      : inState[0];
    if (fallback) return fallback;

    throw new BadRequestException(
      'The Centre of Excellence you selected is no longer taking applications. Choose another one from the list.',
    );
  }
}
