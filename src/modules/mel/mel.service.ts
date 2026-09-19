import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { BeneficiaryStatus } from '@/common/enums/beneficiary.enum';
import { Beneficiary } from '@/modules/beneficiaries/entities/beneficiary.entity';
import { Institution } from '@/modules/institutions/entities/institution.entity';
import { TrainingCompletion } from '@/modules/training/entities/training-completion.entity';
import { EmploymentOutcome } from '@/modules/outcomes/entities/employment-outcome.entity';
import {
  buildPcuMetrics,
  EnrolledGroupRow,
  InstitutionRow,
  PcuMetricsResponse,
  TierRow,
} from './pcu-metrics';

@Injectable()
export class MelService {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Live programme-wide KPI aggregation for the PCU M&E dashboard. Computed on
   * demand from the source tables (no snapshot lag); see buildPcuMetrics for the
   * exact definition of every figure.
   */
  async getPcuMetrics(): Promise<PcuMetricsResponse> {
    const [institutions, enrolled, tiers, completers, placed] =
      await Promise.all([
        this.dataSource.getRepository(Institution).find({
          select: { id: true, name: true, state: true, isActive: true },
          order: { name: 'ASC' },
        }) as Promise<InstitutionRow[]>,

        this.dataSource
          .getRepository(Beneficiary)
          .createQueryBuilder('b')
          .select('b.assignedInstitutionId', 'institutionId')
          .addSelect('b.pillar', 'pillar')
          .addSelect('b.gender', 'gender')
          .addSelect('COUNT(*)', 'count')
          .addSelect(
            `SUM(CASE WHEN b.isNeet = true OR (b.pwdAssistiveRequirement IS NOT NULL AND b.pwdAssistiveRequirement <> '') THEN 1 ELSE 0 END)`,
            'inclusionCount',
          )
          .where('b.status = :status', { status: BeneficiaryStatus.ALLOCATED })
          .groupBy('b.assignedInstitutionId')
          .addGroupBy('b.pillar')
          .addGroupBy('b.gender')
          .getRawMany<EnrolledGroupRow>(),

        this.dataSource
          .getRepository(TrainingCompletion)
          .createQueryBuilder('tc')
          .innerJoin('tc.cohort', 'cohort')
          .innerJoin('cohort.course', 'course')
          .select('course.tier', 'tier')
          .addSelect('COUNT(DISTINCT tc.beneficiaryId)', 'count')
          .where('tc.completed = :done', { done: true })
          .groupBy('course.tier')
          .getRawMany<TierRow>(),

        this.dataSource
          .getRepository(TrainingCompletion)
          .createQueryBuilder('tc')
          .select('COUNT(DISTINCT tc.beneficiaryId)', 'count')
          .where('tc.completed = :done', { done: true })
          .getRawOne<{ count: string }>(),

        this.dataSource
          .getRepository(EmploymentOutcome)
          .createQueryBuilder('eo')
          .innerJoin(
            TrainingCompletion,
            'tc',
            'tc.beneficiaryId = eo.beneficiaryId AND tc.completed = :done',
            { done: true },
          )
          .select('COUNT(DISTINCT eo.beneficiaryId)', 'count')
          .where('eo.verified = :verified', { verified: true })
          .getRawOne<{ count: string }>(),
      ]);

    return buildPcuMetrics({
      institutions,
      enrolled,
      tiers,
      completers: Number(completers?.count ?? 0),
      placed: Number(placed?.count ?? 0),
    });
  }
}
