import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Application } from '@/modules/applications/entities/application.entity';
import { ApplicationStatus } from '@/common/enums/application.enum';
import { Match, MatchStatus } from '@/modules/matching/entities/match.entity';
import { JwtPayload } from '@/common/interfaces/jwt-payload.interface';
import { Cohort } from './entities/cohort.entity';
import { TrainingCompletion } from './entities/training-completion.entity';
import { TrainingService } from './training.service';
import { CompletionsResultDto } from './dto/training-responses.dto';
import {
  EnrollBeneficiariesDto,
  EsoCreateCohortDto,
  RecordCompletionsDto,
  UpdateCohortDto,
  UpdateCohortStatusDto,
} from './dto/training.dto';

const NOT_MATCHED = 'Your organisation has not been matched to a Centre of Excellence yet';

@Injectable()
export class EsoTrainingService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly trainingService: TrainingService,
  ) {}

  private async hostInstitutionId(userId: string): Promise<string> {
    const application = await this.dataSource.getRepository(Application).findOne({
      where: { submittedByOrgId: userId, status: ApplicationStatus.MATCHED },
    });
    if (!application) throw new ForbiddenException(NOT_MATCHED);
    const match = await this.dataSource
      .getRepository(Match)
      .findOne({ where: { applicationId: application.id, status: MatchStatus.ACCEPTED } });
    if (match) return match.institutionId;
    if (application.preferredInstitutionId) return application.preferredInstitutionId;
    throw new ForbiddenException(NOT_MATCHED);
  }

  private async ownCohort(userId: string, cohortId: string): Promise<Cohort> {
    const institutionId = await this.hostInstitutionId(userId);
    const cohort = await this.dataSource.getRepository(Cohort).findOne({ where: { id: cohortId } });
    if (!cohort) throw new NotFoundException('Cohort not found');
    if (cohort.institutionId !== institutionId) {
      throw new ForbiddenException('This cohort belongs to another Centre of Excellence');
    }
    return cohort;
  }

  listCourses() {
    return this.trainingService.listCourses();
  }

  async listCohorts(userId: string) {
    const institutionId = await this.hostInstitutionId(userId);
    const cohorts = (await this.trainingService.listCohorts()).filter((c) => c.institutionId === institutionId);
    if (cohorts.length === 0) return [];
    const rows = await this.dataSource
      .getRepository(TrainingCompletion)
      .createQueryBuilder('c')
      .select('c.cohortId', 'cohortId')
      .addSelect('SUM(CASE WHEN c.completed THEN 1 ELSE 0 END)', 'completed')
      .addSelect('SUM(CASE WHEN c.certified THEN 1 ELSE 0 END)', 'certified')
      .where('c.cohortId IN (:...ids)', { ids: cohorts.map((c) => c.id) })
      .groupBy('c.cohortId')
      .getRawMany<{ cohortId: string; completed: string; certified: string }>();
    const byCohort = new Map(rows.map((r) => [r.cohortId, r]));
    return cohorts.map((cohort) => ({
      ...cohort,
      completedCount: Number(byCohort.get(cohort.id)?.completed ?? 0),
      certifiedCount: Number(byCohort.get(cohort.id)?.certified ?? 0),
    }));
  }

  async createCohort(user: JwtPayload, dto: EsoCreateCohortDto) {
    const institutionId = await this.hostInstitutionId(user.sub);
    return this.trainingService.createCohort({ ...dto, institutionId });
  }

  async updateCohort(user: JwtPayload, id: string, dto: UpdateCohortDto) {
    await this.ownCohort(user.sub, id);
    return this.trainingService.updateCohort(id, dto, user);
  }

  async updateCohortStatus(user: JwtPayload, id: string, dto: UpdateCohortStatusDto) {
    await this.ownCohort(user.sub, id);
    return this.trainingService.updateCohortStatus(id, dto, user);
  }

  async listMembers(user: JwtPayload, id: string) {
    await this.ownCohort(user.sub, id);
    return this.trainingService.listMembers(id);
  }

  async enroll(user: JwtPayload, id: string, dto: EnrollBeneficiariesDto) {
    await this.ownCohort(user.sub, id);
    return this.trainingService.enrollBeneficiaries(id, dto, user.sub, user.role);
  }

  async recordCompletions(user: JwtPayload, id: string, dto: RecordCompletionsDto): Promise<CompletionsResultDto> {
    await this.ownCohort(user.sub, id);
    return this.trainingService.recordCompletions(id, dto);
  }
}
