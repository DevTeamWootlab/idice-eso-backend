import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Institution } from './entities/institution.entity';
import { StateOfNigeria } from '@/common/enums/beneficiary.enum';

@Injectable()
export class InstitutionsService {
  constructor(
    @InjectRepository(Institution)
    private readonly institutionRepo: Repository<Institution>,
  ) {}

  /**
   * Retrieves light metadata of active institutions for dropdown selection
   */
  async findPublicActiveOptions(state?: StateOfNigeria) {
    const query = this.institutionRepo
      .createQueryBuilder('institution')
      .select([
        'institution.id',
        'institution.name',
        'institution.hubType',
        'institution.state',
        'institution.latitude',
        'institution.longitude',
        'institution.beneficiaryCapacity',
        'institution.isActive',
      ])
      .where('institution.isActive = :isActive', { isActive: true });

    if (state) {
      query.andWhere('institution.state = :state', { state });
    }

    return query.orderBy('institution.name', 'ASC').getMany();
  }
}
