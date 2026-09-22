import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { Beneficiary } from '@/modules/beneficiaries/entities/beneficiary.entity';
import { Institution } from '@/modules/institutions/entities/institution.entity';
import { Cohort } from './entities/cohort.entity';
import { CohortMember } from './entities/cohort-member.entity';
import { Course } from './entities/course.entity';
import { TrainingCompletion } from './entities/training-completion.entity';
import {
  CreateCohortDto,
  EnrollBeneficiariesDto,
  RecordCompletionsDto,
  UpdateCohortStatusDto,
} from './dto/training.dto';
import {
  canRecordCompletions,
  canTransitionCohort,
  completionBlocker,
  enrolmentBlocker,
  isOpenForEnrolment,
} from './training-rules';

interface Rejection {
  beneficiaryId: string;
  reason: string;
}

@Injectable()
export class TrainingService {
  constructor(
    @InjectRepository(Cohort)
    private readonly cohortRepo: Repository<Cohort>,
    @InjectRepository(CohortMember)
    private readonly memberRepo: Repository<CohortMember>,
    @InjectRepository(Course)
    private readonly courseRepo: Repository<Course>,
    @InjectRepository(TrainingCompletion)
    private readonly completionRepo: Repository<TrainingCompletion>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  listCourses() {
    return this.courseRepo.find({
      where: { isActive: true },
      order: { tier: 'ASC', title: 'ASC' },
    });
  }

  async listCohorts() {
    const cohorts = await this.cohortRepo.find({
      relations: { institution: true, course: true },
      order: { startDate: 'DESC' },
    });
    if (cohorts.length === 0) return [];

    const rows = await this.memberRepo
      .createQueryBuilder('member')
      .select('member.cohortId', 'cohortId')
      .addSelect('COUNT(*)', 'count')
      .where('member.cohortId IN (:...ids)', { ids: cohorts.map((c) => c.id) })
      .andWhere('member.isActive = :active', { active: true })
      .groupBy('member.cohortId')
      .getRawMany<{ cohortId: string; count: string }>();
    const counts = new Map(rows.map((r) => [r.cohortId, Number(r.count)]));

    return cohorts.map((cohort) => ({
      ...cohort,
      memberCount: counts.get(cohort.id) ?? 0,
    }));
  }

  async createCohort(dto: CreateCohortDto) {
    if (dto.endDate && dto.endDate < dto.startDate) {
      throw new BadRequestException('endDate cannot be before startDate');
    }
    const institution = await this.dataSource
      .getRepository(Institution)
      .findOne({ where: { id: dto.institutionId, isActive: true } });
    if (!institution) {
      throw new BadRequestException('Institution not found or inactive');
    }
    const course = await this.courseRepo.findOne({
      where: { id: dto.courseId, isActive: true },
    });
    if (!course) throw new BadRequestException('Course not found or inactive');

    const cohort = this.cohortRepo.create({
      name: dto.name.trim(),
      institutionId: dto.institutionId,
      courseId: dto.courseId,
      startDate: dto.startDate as unknown as Date,
      endDate: dto.endDate as unknown as Date,
      capacity: dto.capacity ?? 0,
    });
    return this.cohortRepo.save(cohort);
  }

  async updateCohortStatus(id: string, dto: UpdateCohortStatusDto) {
    const cohort = await this.requireCohort(id);
    if (!canTransitionCohort(cohort.status, dto.status)) {
      throw new BadRequestException(
        `Cannot move a cohort from ${cohort.status} to ${dto.status}`,
      );
    }
    cohort.status = dto.status;
    return this.cohortRepo.save(cohort);
  }

  async enroll(cohortId: string, dto: EnrollBeneficiariesDto) {
    const cohort = await this.requireCohort(cohortId);
    if (!isOpenForEnrolment(cohort.status)) {
      throw new BadRequestException(
        `A ${cohort.status} cohort is not open for enrolment`,
      );
    }

    const ids = Array.from(new Set(dto.beneficiaryIds));
    const beneficiaries = await this.dataSource
      .getRepository(Beneficiary)
      .find({ where: { id: In(ids) } });
    const byId = new Map(beneficiaries.map((b) => [b.id, b]));

    const existing = await this.memberRepo.find({
      where: { cohortId, beneficiaryId: In(ids) },
    });
    const alreadyEnrolled = new Set(existing.map((m) => m.beneficiaryId));

    let seatsLeft = Number.POSITIVE_INFINITY;
    if (cohort.capacity > 0) {
      const taken = await this.memberRepo.count({
        where: { cohortId, isActive: true },
      });
      seatsLeft = cohort.capacity - taken;
    }

    const toCreate: CohortMember[] = [];
    const rejected: Rejection[] = [];
    for (const id of ids) {
      const beneficiary = byId.get(id);
      if (!beneficiary) {
        rejected.push({ beneficiaryId: id, reason: 'Beneficiary not found' });
        continue;
      }
      if (alreadyEnrolled.has(id)) continue;
      const blocker = enrolmentBlocker(beneficiary, cohort);
      if (blocker) {
        rejected.push({ beneficiaryId: id, reason: blocker });
        continue;
      }
      if (seatsLeft <= 0) {
        rejected.push({ beneficiaryId: id, reason: 'Cohort is at capacity' });
        continue;
      }
      seatsLeft -= 1;
      toCreate.push(
        this.memberRepo.create({
          cohortId,
          beneficiaryId: id,
          enrolledAt: new Date(),
          isActive: true,
        }),
      );
    }

    if (toCreate.length > 0) await this.memberRepo.save(toCreate);

    return {
      enrolled: toCreate.map((m) => m.beneficiaryId),
      alreadyEnrolled: ids.filter((id) => alreadyEnrolled.has(id)),
      rejected,
    };
  }

  async recordCompletions(cohortId: string, dto: RecordCompletionsDto) {
    const cohort = await this.requireCohort(cohortId);
    if (!canRecordCompletions(cohort.status)) {
      throw new BadRequestException(
        'Completions can only be recorded for active or completed cohorts',
      );
    }

    const ids = dto.records.map((r) => r.beneficiaryId);
    const members = await this.memberRepo.find({
      where: { cohortId, beneficiaryId: In(ids), isActive: true },
    });
    const memberIds = new Set(members.map((m) => m.beneficiaryId));
    const existing = await this.completionRepo.find({
      where: { cohortId, beneficiaryId: In(ids) },
    });
    const existingByBeneficiary = new Map(
      existing.map((c) => [c.beneficiaryId, c]),
    );

    const toSave: TrainingCompletion[] = [];
    const rejected: Rejection[] = [];
    for (const record of dto.records) {
      if (!memberIds.has(record.beneficiaryId)) {
        rejected.push({
          beneficiaryId: record.beneficiaryId,
          reason: 'Beneficiary is not an active member of this cohort',
        });
        continue;
      }
      const blocker = completionBlocker(record);
      if (blocker) {
        rejected.push({ beneficiaryId: record.beneficiaryId, reason: blocker });
        continue;
      }

      const row =
        existingByBeneficiary.get(record.beneficiaryId) ??
        this.completionRepo.create({
          cohortId,
          beneficiaryId: record.beneficiaryId,
        });
      const wasCompleted = row.completed === true;
      row.completed = record.completed;
      row.certified = record.completed ? (record.certified ?? false) : false;
      if (record.attendanceRate !== undefined) {
        row.attendanceRate = record.attendanceRate;
      }
      if (record.completed) {
        row.completedAt = wasCompleted ? row.completedAt : new Date();
      } else {
        row.completedAt = null as unknown as Date;
      }
      toSave.push(row);
    }

    if (toSave.length > 0) await this.completionRepo.save(toSave);
    return { saved: toSave.length, rejected };
  }

  async listMembers(cohortId: string) {
    await this.requireCohort(cohortId);
    const members = await this.memberRepo
      .createQueryBuilder('member')
      .innerJoin('member.beneficiary', 'b')
      .select(['member.id', 'member.beneficiaryId', 'member.enrolledAt', 'member.isActive'])
      .addSelect(['b.id', 'b.fullName', 'b.referenceId'])
      .where('member.cohortId = :cohortId', { cohortId })
      .orderBy('b.fullName', 'ASC')
      .getMany();
    const completions = await this.completionRepo.find({ where: { cohortId } });
    const byBeneficiary = new Map(completions.map((c) => [c.beneficiaryId, c]));

    return members.map((member) => {
      const completion = byBeneficiary.get(member.beneficiaryId);
      return {
        beneficiaryId: member.beneficiaryId,
        fullName: member.beneficiary.fullName,
        referenceId: member.beneficiary.referenceId,
        enrolledAt: member.enrolledAt,
        isActive: member.isActive,
        completed: completion?.completed ?? false,
        certified: completion?.certified ?? false,
        attendanceRate:
          completion?.attendanceRate === null ||
          completion?.attendanceRate === undefined
            ? null
            : Number(completion.attendanceRate),
      };
    });
  }

  private async requireCohort(id: string): Promise<Cohort> {
    const cohort = await this.cohortRepo.findOne({ where: { id } });
    if (!cohort) throw new NotFoundException('Cohort not found');
    return cohort;
  }
}
