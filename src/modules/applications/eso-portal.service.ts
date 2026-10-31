import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, In, IsNull, Not } from 'typeorm';
import { Application } from './entities/application.entity';
import { ApplicationStatus } from '@/common/enums/application.enum';
import { Match, MatchStatus } from '@/modules/matching/entities/match.entity';
import { EligibilityChecklist } from '@/modules/eligibility/entities/eligibility-checklist.entity';
import { ScoreCard } from '@/modules/scoring/entities/score-card.entity';
import { RubricConfiguration } from '@/modules/scoring/entities/rubric-configuration.entity';
import { Cohort } from '@/modules/training/entities/cohort.entity';
import { CohortMember } from '@/modules/training/entities/cohort-member.entity';
import { TrainingCompletion } from '@/modules/training/entities/training-completion.entity';
import { MentorAssignment } from '@/modules/mentorship/entities/mentor-assignment.entity';
import { Beneficiary } from '@/modules/beneficiaries/entities/beneficiary.entity';
import { BeneficiaryStatus, Pillar } from '@/common/enums/beneficiary.enum';
import { MentorshipStatus } from '@/common/enums/mentorship.enum';

const NOT_MATCHED = 'This application has not been matched to a Centre of Excellence yet';

const DOMAIN_FIELDS: Record<string, keyof ScoreCard> = {
  LOCAL_PRESENCE: 'localPresenceScore',
  TEAM_EXPERTISE: 'teamExpertiseScore',
  INCUBATION_EXPERIENCE: 'incubationExperienceScore',
  GOVERNANCE_COMPLIANCE: 'credibilityGovernanceScore',
  DELIVERY_TRACK_RECORD: 'deliveryTrackRecordScore',
  INSTITUTIONAL_ALIGNMENT: 'institutionalAlignmentScore',
};

const round1 = (value: number) => Math.round(value * 10) / 10;

@Injectable()
export class EsoPortalService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  private async owned(userId: string, id: string) {
    const application = await this.dataSource.getRepository(Application).findOne({ where: { id } });
    if (!application) throw new NotFoundException('Application not found');
    if (application.submittedByOrgId !== userId) {
      throw new ForbiddenException('You do not have access to this application');
    }
    return application;
  }

  async assessment(userId: string, id: string) {
    const application = await this.owned(userId, id);

    const checklist = await this.dataSource.getRepository(EligibilityChecklist).findOne({
      where: { applicationId: id, overallResult: Not(IsNull()) },
      relations: { items: true },
      order: { decidedAt: 'DESC' },
    });
    const eligibility = checklist
      ? {
          result: checklist.overallResult,
          decidedAt: checklist.decidedAt ? new Date(checklist.decidedAt).toISOString() : null,
          items: (checklist.items ?? []).map((item) => ({ code: item.code, passed: item.passed })),
        }
      : null;

    let scoring = null;
    if (application.finalScorePercent !== null && application.finalScorePercent !== undefined) {
      const cards = await this.dataSource
        .getRepository(ScoreCard)
        .find({ where: { applicationId: id, submitted: true } });
      const dimensions = await this.dataSource
        .getRepository(RubricConfiguration)
        .find({ where: { isActive: true }, order: { weightPercentage: 'DESC' } });
      scoring = {
        finalScorePercent: Number(application.finalScorePercent),
        domains: dimensions
          .filter((d) => DOMAIN_FIELDS[d.dimensionCode])
          .map((d) => {
            const values = cards
              .map((card) => card[DOMAIN_FIELDS[d.dimensionCode]])
              .filter((value): value is number => typeof value === 'number');
            const average = values.length ? values.reduce((sum, v) => sum + v, 0) / values.length : null;
            return {
              code: d.dimensionCode,
              label: d.label,
              weightPercentage: Number(d.weightPercentage),
              averageScore: average === null ? null : round1(average),
              percent: average === null ? null : Math.round((average / 5) * 100),
            };
          }),
      };
    }

    return { status: application.status, eligibility, scoring };
  }

  async programme(userId: string, id: string) {
    const application = await this.owned(userId, id);
    if (application.status !== ApplicationStatus.MATCHED) throw new ForbiddenException(NOT_MATCHED);
    const match = await this.dataSource
      .getRepository(Match)
      .findOne({ where: { applicationId: id, status: MatchStatus.ACCEPTED } });
    if (!match) throw new ForbiddenException(NOT_MATCHED);

    const cohorts = await this.dataSource.getRepository(Cohort).find({
      where: { institutionId: match.institutionId },
      relations: { course: true },
      order: { startDate: 'ASC' },
    });
    const ids = cohorts.map((c) => c.id);
    const memberRows = ids.length
      ? await this.dataSource
          .getRepository(CohortMember)
          .createQueryBuilder('m')
          .select('m.cohortId', 'cohortId')
          .addSelect('COUNT(*)', 'count')
          .where('m.cohortId IN (:...ids)', { ids })
          .andWhere('m.isActive = true')
          .groupBy('m.cohortId')
          .getRawMany<{ cohortId: string; count: string }>()
      : [];
    const completionRows = ids.length
      ? await this.dataSource
          .getRepository(TrainingCompletion)
          .createQueryBuilder('c')
          .select('c.cohortId', 'cohortId')
          .addSelect('SUM(CASE WHEN c.completed THEN 1 ELSE 0 END)', 'completed')
          .addSelect('SUM(CASE WHEN c.certified THEN 1 ELSE 0 END)', 'certified')
          .where('c.cohortId IN (:...ids)', { ids })
          .groupBy('c.cohortId')
          .getRawMany<{ cohortId: string; completed: string; certified: string }>()
      : [];
    const members = new Map(memberRows.map((r) => [r.cohortId, Number(r.count)]));
    const completions = new Map(completionRows.map((r) => [r.cohortId, r]));

    const startups = await this.dataSource.getRepository(Beneficiary).find({
      select: { id: true },
      where: {
        assignedInstitutionId: match.institutionId,
        status: BeneficiaryStatus.ALLOCATED,
        pillar: In([Pillar.INCUBATION, Pillar.ACCELERATION]),
      },
    });
    const startupIds = startups.map((b) => b.id);
    const linked = startupIds.length
      ? await this.dataSource
          .getRepository(MentorAssignment)
          .createQueryBuilder('a')
          .select('COUNT(DISTINCT a.beneficiaryId)', 'count')
          .where('a.beneficiaryId IN (:...startupIds)', { startupIds })
          .andWhere('a.status IN (:...statuses)', { statuses: [MentorshipStatus.ACTIVE, MentorshipStatus.COMPLETED] })
          .getRawOne<{ count: string }>()
      : { count: '0' };

    return {
      institutionId: match.institutionId,
      cohorts: cohorts.map((cohort) => {
        const done = completions.get(cohort.id);
        return {
          id: cohort.id,
          name: cohort.name,
          tier: cohort.course?.tier ?? null,
          courseTitle: cohort.course?.title ?? null,
          startDate: cohort.startDate,
          endDate: cohort.endDate ?? null,
          status: cohort.status,
          capacity: cohort.capacity,
          memberCount: members.get(cohort.id) ?? 0,
          completedCount: Number(done?.completed ?? 0),
          certifiedCount: Number(done?.certified ?? 0),
        };
      }),
      mentorship: {
        startupsAllocated: startupIds.length,
        startupsLinked: Number(linked?.count ?? 0),
      },
    };
  }
}
