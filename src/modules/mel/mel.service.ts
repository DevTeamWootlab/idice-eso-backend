import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, SelectQueryBuilder } from 'typeorm';
import { BeneficiaryStatus } from '@/common/enums/beneficiary.enum';
import { Beneficiary } from '@/modules/beneficiaries/entities/beneficiary.entity';
import { Institution } from '@/modules/institutions/entities/institution.entity';
import { Cohort } from '@/modules/training/entities/cohort.entity';
import { CohortMember } from '@/modules/training/entities/cohort-member.entity';
import { TrainingCompletion } from '@/modules/training/entities/training-completion.entity';
import { EmploymentOutcome } from '@/modules/outcomes/entities/employment-outcome.entity';
import {
  buildPcuMetrics,
  percentOf,
  EnrolledGroupRow,
  InstitutionRow,
  PcuMetricsResponse,
  TierRow,
} from './pcu-metrics';
import {
  classifyRegulator,
  exclusiveEnd,
  filterInstitutions,
  hasInstitutionScope,
  PcuFilters,
} from './pcu-filters';
import { buildReportModel, ReportKind, ReportModel } from './pcu-report';

@Injectable()
export class MelService {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  private applyPeriod(qb: SelectQueryBuilder<any>, expression: string, filters: PcuFilters) {
    if (filters.from) qb.andWhere(`${expression} >= :periodFrom`, { periodFrom: new Date(filters.from) });
    if (filters.to) qb.andWhere(`${expression} < :periodTo`, { periodTo: exclusiveEnd(filters.to) });
  }

  private loadInstitutions(): Promise<InstitutionRow[]> {
    return this.dataSource.getRepository(Institution).find({
      select: { id: true, name: true, state: true, isActive: true },
      order: { name: 'ASC' },
    }) as Promise<InstitutionRow[]>;
  }

  private queryEnrolled(filters: PcuFilters, scopeIds: string[] | null): Promise<EnrolledGroupRow[]> {
    const qb = this.dataSource
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
      .where('b.status = :status', { status: BeneficiaryStatus.ALLOCATED });
    if (scopeIds) qb.andWhere('b.assignedInstitutionId IN (:...scopeIds)', { scopeIds });
    if (filters.cohortId) {
      qb.andWhere((inner: SelectQueryBuilder<Beneficiary>) => {
        const members = inner
          .subQuery()
          .select('cm.beneficiaryId')
          .from(CohortMember, 'cm')
          .where('cm.cohortId = :cohortId')
          .andWhere('cm.isActive = true')
          .getQuery();
        return `b.id IN ${members}`;
      }).setParameter('cohortId', filters.cohortId);
    }
    this.applyPeriod(qb, 'COALESCE(b.allocatedAt, b.createdAt)', filters);
    return qb
      .groupBy('b.assignedInstitutionId')
      .addGroupBy('b.pillar')
      .addGroupBy('b.gender')
      .getRawMany<EnrolledGroupRow>();
  }

  private queryTiers(filters: PcuFilters, scopeIds: string[] | null): Promise<TierRow[]> {
    const qb = this.dataSource
      .getRepository(TrainingCompletion)
      .createQueryBuilder('tc')
      .innerJoin('tc.cohort', 'cohort')
      .innerJoin('cohort.course', 'course')
      .select('course.tier', 'tier')
      .addSelect('COUNT(DISTINCT tc.beneficiaryId)', 'count')
      .where('tc.completed = :done', { done: true });
    if (scopeIds) qb.andWhere('cohort.institutionId IN (:...scopeIds)', { scopeIds });
    if (filters.cohortId) qb.andWhere('tc.cohortId = :cohortId', { cohortId: filters.cohortId });
    this.applyPeriod(qb, 'tc.completedAt', filters);
    return qb.groupBy('course.tier').getRawMany<TierRow>();
  }

  private async queryCompleters(filters: PcuFilters, scopeIds: string[] | null): Promise<number> {
    const qb = this.dataSource
      .getRepository(TrainingCompletion)
      .createQueryBuilder('tc')
      .innerJoin('tc.cohort', 'cohort')
      .select('COUNT(DISTINCT tc.beneficiaryId)', 'count')
      .where('tc.completed = :done', { done: true });
    if (scopeIds) qb.andWhere('cohort.institutionId IN (:...scopeIds)', { scopeIds });
    if (filters.cohortId) qb.andWhere('tc.cohortId = :cohortId', { cohortId: filters.cohortId });
    this.applyPeriod(qb, 'tc.completedAt', filters);
    return Number((await qb.getRawOne<{ count: string }>())?.count ?? 0);
  }

  private async queryPlaced(filters: PcuFilters, scopeIds: string[] | null): Promise<number> {
    const qb = this.dataSource
      .getRepository(EmploymentOutcome)
      .createQueryBuilder('eo')
      .innerJoin(
        TrainingCompletion,
        'tc',
        `tc.beneficiaryId = eo.beneficiaryId AND tc.completed = :done${filters.cohortId ? ' AND tc.cohortId = :cohortId' : ''}`,
        { done: true, ...(filters.cohortId ? { cohortId: filters.cohortId } : {}) },
      )
      .select('COUNT(DISTINCT eo.beneficiaryId)', 'count')
      .where('eo.verified = :verified', { verified: true });
    if (scopeIds) {
      qb.innerJoin('eo.beneficiary', 'ben').andWhere('ben.assignedInstitutionId IN (:...scopeIds)', { scopeIds });
    }
    this.applyPeriod(qb, 'COALESCE(eo.achievedOn, eo.createdAt)', filters);
    return Number((await qb.getRawOne<{ count: string }>())?.count ?? 0);
  }

  /**
   * Live programme KPI aggregation for the PCU M&E dashboard, optionally narrowed by state,
   * Centre of Excellence, cohort, regulator (NUC / NBTE) and time period. Computed on demand
   * from the source tables; see buildPcuMetrics for the exact definition of every figure.
   */
  async getPcuMetrics(filters: PcuFilters = {}): Promise<PcuMetricsResponse> {
    const all = await this.loadInstitutions();
    const scoped = hasInstitutionScope(filters) ? filterInstitutions(all, filters) : all;
    const scopeIds = hasInstitutionScope(filters) ? scoped.map((i) => i.id) : null;
    if (scopeIds && scopeIds.length === 0) {
      return buildPcuMetrics({ institutions: [], enrolled: [], tiers: [], completers: 0, placed: 0 });
    }

    const [enrolled, tiers, completers, placed] = await Promise.all([
      this.queryEnrolled(filters, scopeIds),
      this.queryTiers(filters, scopeIds),
      this.queryCompleters(filters, scopeIds),
      this.queryPlaced(filters, scopeIds),
    ]);
    return buildPcuMetrics({ institutions: scoped, enrolled, tiers, completers, placed });
  }

  /** Drill-down for one Centre of Excellence: its KPIs, mix of youth and every cohort. */
  async getCoeDetail(institutionId: string, filters: PcuFilters = {}) {
    const institution = await this.dataSource.getRepository(Institution).findOne({ where: { id: institutionId } });
    if (!institution) throw new NotFoundException('Centre of Excellence not found');

    const scope: PcuFilters = { ...filters, institutionId, state: undefined, regulator: undefined };
    const [metrics, enrolledRows] = await Promise.all([
      this.getPcuMetrics(scope),
      this.queryEnrolled(scope, [institutionId]),
    ]);

    const tally = (pick: (row: EnrolledGroupRow) => string) => {
      const totals = new Map<string, number>();
      for (const row of enrolledRows) totals.set(pick(row), (totals.get(pick(row)) ?? 0) + Number(row.count));
      return [...totals.entries()].map(([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count);
    };

    const cohorts = await this.dataSource.getRepository(Cohort).find({
      where: { institutionId },
      relations: { course: true },
      order: { startDate: 'DESC' },
    });
    const ids = cohorts.map((c) => c.id);
    const count = async (query: SelectQueryBuilder<any>, extra: string) => {
      if (ids.length === 0) return new Map<string, number>();
      const rows = await query
        .select('x.cohortId', 'cohortId')
        .addSelect('COUNT(DISTINCT x.beneficiaryId)', 'count')
        .where('x.cohortId IN (:...ids)', { ids })
        .andWhere(extra)
        .groupBy('x.cohortId')
        .getRawMany<{ cohortId: string; count: string }>();
      return new Map(rows.map((r) => [r.cohortId, Number(r.count)]));
    };
    const [members, completed] = await Promise.all([
      count(this.dataSource.getRepository(CohortMember).createQueryBuilder('x'), 'x.isActive = true'),
      count(this.dataSource.getRepository(TrainingCompletion).createQueryBuilder('x'), 'x.completed = true'),
    ]);

    return {
      institution: {
        id: institution.id,
        name: institution.name,
        state: institution.state,
        hubType: institution.hubType,
        beneficiaryCapacity: institution.beneficiaryCapacity,
        regulator: classifyRegulator(institution.name),
        isActive: institution.isActive,
      },
      metrics,
      capacityUtilisationPercent: percentOf(metrics.youthEnrolled.value, institution.beneficiaryCapacity),
      pillars: tally((r) => r.pillar),
      genders: tally((r) => r.gender),
      cohorts: cohorts.map((c) => ({
        id: c.id,
        name: c.name,
        courseTitle: c.course?.title ?? null,
        tier: c.course?.tier ?? null,
        status: c.status,
        startDate: String(c.startDate),
        endDate: c.endDate ? String(c.endDate) : null,
        capacity: c.capacity ?? 0,
        members: members.get(c.id) ?? 0,
        completed: completed.get(c.id) ?? 0,
      })),
    };
  }

  /** The data behind a downloadable PCU / NUC / NBTE report. */
  async buildReport(kind: ReportKind, filters: PcuFilters = {}): Promise<ReportModel> {
    const regulator = kind === 'nuc' ? 'NUC' : kind === 'nbte' ? 'NBTE' : undefined;
    const metrics = await this.getPcuMetrics({ ...filters, regulator: regulator ?? filters.regulator });

    const labels: [string, string][] = [];
    if (filters.state) labels.push(['State', filters.state]);
    if (filters.institutionId) {
      const coe = await this.dataSource.getRepository(Institution).findOne({ where: { id: filters.institutionId } });
      labels.push(['Centre of Excellence', coe?.name ?? filters.institutionId]);
    }
    if (filters.cohortId) {
      const cohort = await this.dataSource.getRepository(Cohort).findOne({ where: { id: filters.cohortId } });
      labels.push(['Cohort', cohort?.name ?? filters.cohortId]);
    }
    if (filters.from || filters.to) labels.push(['Period', `${filters.from ?? 'start'} to ${filters.to ?? 'today'}`]);
    return buildReportModel({ kind, metrics, filters: labels });
  }
}
