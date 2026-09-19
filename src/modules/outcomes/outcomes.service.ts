import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository, SelectQueryBuilder } from 'typeorm';
import { Beneficiary } from '@/modules/beneficiaries/entities/beneficiary.entity';
import { TrainingCompletion } from '@/modules/training/entities/training-completion.entity';
import { EmploymentOutcome } from './entities/employment-outcome.entity';
import { RecordEmploymentOutcomeDto } from './dto/record-outcome.dto';
import { ListOutcomesDto, OutcomeFilter } from './dto/list-outcomes.dto';
import { shapeOutcomeCandidates } from './outcome-rows';
import {
  clampPagination,
  escapeLikePattern,
  totalPagesFor,
} from '@/modules/applications/admin-applications.query';

@Injectable()
export class OutcomesService {
  constructor(
    @InjectRepository(EmploymentOutcome)
    private readonly outcomeRepo: Repository<EmploymentOutcome>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Beneficiaries who completed at least one course — the only people an outcome can
   * be recorded for — with their outcome, if any. Two plain queries (a filtered,
   * paged beneficiary query, then lookups for just that page) rather than one
   * grouped join, so the paging stays exact.
   */
  async listCandidates(query: ListOutcomesDto) {
    const { page, limit, skip } = clampPagination(query.page, query.limit);

    const qb = this.dataSource
      .getRepository(Beneficiary)
      .createQueryBuilder('b')
      .leftJoin('b.assignedInstitution', 'institution')
      .select(['b.id', 'b.fullName', 'b.referenceId'])
      .addSelect(['institution.id', 'institution.name'])
      .where((q: SelectQueryBuilder<Beneficiary>) => {
        const completed = q
          .subQuery()
          .select('tc.beneficiaryId')
          .from(TrainingCompletion, 'tc')
          .where('tc.completed = :done')
          .getQuery();
        return `b.id IN ${completed}`;
      })
      .setParameter('done', true);

    const outcomeIds = (q: SelectQueryBuilder<Beneficiary>, byVerified: boolean) => {
      const sub = q
        .subQuery()
        .select('eo.beneficiaryId')
        .from(EmploymentOutcome, 'eo');
      if (byVerified) sub.where('eo.verified = :outcomeVerified');
      return sub.getQuery();
    };
    if (query.outcome === OutcomeFilter.NONE) {
      qb.andWhere(
        (q: SelectQueryBuilder<Beneficiary>) =>
          `b.id NOT IN ${outcomeIds(q, false)}`,
      );
    } else if (query.outcome === OutcomeFilter.VERIFIED) {
      qb.andWhere(
        (q: SelectQueryBuilder<Beneficiary>) => `b.id IN ${outcomeIds(q, true)}`,
      ).setParameter('outcomeVerified', true);
    } else if (query.outcome === OutcomeFilter.UNVERIFIED) {
      qb.andWhere(
        (q: SelectQueryBuilder<Beneficiary>) => `b.id IN ${outcomeIds(q, true)}`,
      ).setParameter('outcomeVerified', false);
    }

    const term = query.search?.trim();
    if (term) {
      qb.andWhere('(b.fullName ILIKE :term OR b.referenceId ILIKE :term)', {
        term: `%${escapeLikePattern(term)}%`,
      });
    }

    const [rows, total] = await qb
      .orderBy('b.fullName', 'ASC')
      .addOrderBy('b.id', 'ASC')
      .offset(skip)
      .limit(limit)
      .getManyAndCount();

    const ids = rows.map((row) => row.id);
    const outcomes = ids.length
      ? await this.outcomeRepo.find({ where: { beneficiaryId: In(ids) } })
      : [];
    const completions = ids.length
      ? await this.dataSource
          .getRepository(TrainingCompletion)
          .createQueryBuilder('tc')
          .select('tc.beneficiaryId', 'beneficiaryId')
          .addSelect('MAX(tc.completedAt)', 'completedAt')
          .where('tc.completed = :done', { done: true })
          .andWhere('tc.beneficiaryId IN (:...ids)', { ids })
          .groupBy('tc.beneficiaryId')
          .getRawMany<{ beneficiaryId: string; completedAt: Date | string | null }>()
      : [];

    return {
      items: shapeOutcomeCandidates(rows, outcomes, completions),
      total,
      page,
      limit,
      totalPages: totalPagesFor(total, limit),
    };
  }

  /**
   * One outcome per beneficiary (the relation is one-to-one), so recording again
   * updates it — that is also how an outcome gets verified later.
   */
  async record(dto: RecordEmploymentOutcomeDto, adminId: string) {
    const beneficiary = await this.dataSource
      .getRepository(Beneficiary)
      .findOne({ where: { id: dto.beneficiaryId } });
    if (!beneficiary) throw new NotFoundException('Beneficiary not found');

    const completions = await this.dataSource
      .getRepository(TrainingCompletion)
      .count({ where: { beneficiaryId: dto.beneficiaryId, completed: true } });
    if (completions === 0) {
      throw new BadRequestException(
        'Employment outcomes can only be recorded for beneficiaries who completed training',
      );
    }

    const verified = dto.verified ?? false;
    const outcome =
      (await this.outcomeRepo.findOne({
        where: { beneficiaryId: dto.beneficiaryId },
      })) ??
      this.outcomeRepo.create({ beneficiaryId: dto.beneficiaryId });

    outcome.outcomeType = dto.outcomeType;
    outcome.employerOrVentureName = dto.employerOrVentureName as string;
    outcome.achievedOn = dto.achievedOn as unknown as Date;
    outcome.verified = verified;
    outcome.verifiedBy = verified ? adminId : (null as unknown as string);

    return this.outcomeRepo.save(outcome);
  }
}
