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
  UpdateCohortDto,
  RecordCompletionsDto,
  UpdateCohortStatusDto,
} from './dto/training.dto';
import {
  canRecordCompletions,
  canTransitionCohort,
  completionBlocker,
  enrolmentBlocker,
  isEditable,
  isOpenForEnrolment,
} from './training-rules';
import { AuditLogService } from '@/modules/audit-log/audit-log.service';
import { JwtPayload } from '@/common/interfaces/jwt-payload.interface';
import { BulkEnrollmentResult, EnrollmentResultItem } from './dto/enrollment-result.interface';

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
    private readonly auditLogService: AuditLogService,
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

  async updateCohortStatus(
    id: string,
    dto: UpdateCohortStatusDto,
    actor?: JwtPayload,
  ) {
    const cohort = await this.requireCohort(id);
    if (!canTransitionCohort(cohort.status, dto.status)) {
      throw new BadRequestException(
        `Cannot move a cohort from ${cohort.status} to ${dto.status}`,
      );
    }
    const from = cohort.status;
    cohort.status = dto.status;
    const saved = await this.cohortRepo.save(cohort);
    if (actor) {
      await this.auditLogService.record({
        actorId: actor.sub,
        actorRole: actor.role,
        action: 'COHORT_STATUS_CHANGED',
        entityType: 'Cohort',
        entityId: id,
        metadata: { from, to: dto.status },
      });
    }
    return saved;
  }

  async updateCohort(id: string, dto: UpdateCohortDto, actor: JwtPayload) {
    const cohort = await this.requireCohort(id);
    if (!isEditable(cohort.status)) {
      throw new BadRequestException(
        `A ${cohort.status} cohort can no longer be edited`,
      );
    }

    const before = {
      name: cohort.name,
      startDate: this.dateOnly(cohort.startDate),
      endDate: cohort.endDate ? this.dateOnly(cohort.endDate) : null,
      capacity: cohort.capacity,
    };
    const next = {
      name: dto.name !== undefined ? dto.name.trim() : before.name,
      startDate: dto.startDate ?? before.startDate,
      endDate: dto.endDate !== undefined ? dto.endDate : before.endDate,
      capacity: dto.capacity ?? before.capacity,
    };

    if (!next.name)
      throw new BadRequestException('Cohort name cannot be empty');
    if (next.endDate && next.endDate < next.startDate) {
      throw new BadRequestException('endDate cannot be before startDate');
    }
    if (next.capacity > 0) {
      const taken = await this.memberRepo.count({
        where: { cohortId: id, isActive: true },
      });
      if (next.capacity < taken) {
        throw new BadRequestException(
          `Capacity cannot be lower than the ${taken} trainees already enrolled`,
        );
      }
    }

    cohort.name = next.name;
    cohort.startDate = next.startDate as unknown as Date;
    cohort.endDate = (next.endDate ?? null) as unknown as Date;
    cohort.capacity = next.capacity;
    await this.cohortRepo.save(cohort);

    await this.auditLogService.record({
      actorId: actor.sub,
      actorRole: actor.role,
      action: 'COHORT_UPDATED',
      entityType: 'Cohort',
      entityId: id,
      metadata: { before, after: next },
    });

    return this.cohortRepo.findOne({
      where: { id },
      relations: { institution: true, course: true },
    });
  }

  private dateOnly(value: Date | string): string {
    return typeof value === 'string'
      ? value.slice(0, 10)
      : value.toISOString().slice(0, 10);
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

  async enrollBeneficiaries(
    cohortId: string,
    dto: EnrollBeneficiariesDto,
    actorId: string,
  ): Promise<BulkEnrollmentResult> {
    return this.dataSource.transaction(async (manager) => {
      // 1. Lock cohort row to prevent concurrent capacity overfill
      const cohort = await manager
        .getRepository(Cohort)
        .createQueryBuilder('cohort')
        .setLock('pessimistic_write')
        .where('cohort.id = :cohortId', { cohortId })
        .getOne();

      if (!cohort) {
        throw new NotFoundException('Cohort not found');
      }

      if (!isOpenForEnrolment(cohort.status)) {
        throw new BadRequestException(
          `Cohort status '${cohort.status}' is not open for enrolment`,
        );
      }

      // 2. Pre-deduplicate input IDs
      const uniqueIds = Array.from(new Set(dto.beneficiaryIds));

      // 3. Batched fetch: Beneficiaries & Existing Enrollments (No N+1 queries)
      const [beneficiaries, existingMembers, currentActiveCount] =
        await Promise.all([
          manager
            .getRepository(Beneficiary)
            .find({ where: { id: In(uniqueIds) } }),
          manager.getRepository(CohortMember).find({
            where: { cohortId, beneficiaryId: In(uniqueIds) },
            select: { beneficiaryId: true },
          }),
          manager.getRepository(CohortMember).count({
            where: { cohortId, isActive: true },
          }),
        ]);

      const beneficiaryMap = new Map(beneficiaries.map((b) => [b.id, b]));
      const alreadyEnrolledSet = new Set(
        existingMembers.map((m) => m.beneficiaryId),
      );

      let activeCount = currentActiveCount;
      const results: EnrollmentResultItem[] = [];
      const toInsert: CohortMember[] = [];

      // 4. Process candidates in memory
      for (const id of uniqueIds) {
        const beneficiary = beneficiaryMap.get(id);

        if (!beneficiary) {
          results.push({ beneficiaryId: id, outcome: 'BENEFICIARY_NOT_FOUND' });
          continue;
        }

        if (alreadyEnrolledSet.has(id)) {
          results.push({ beneficiaryId: id, outcome: 'ALREADY_ENROLLED' });
          continue;
        }

        const blocker = enrolmentBlocker(beneficiary, cohort);
        if (blocker) {
          results.push({
            beneficiaryId: id,
            outcome: 'REJECTED',
            reason: blocker,
          });
          continue;
        }

        if (cohort.capacity > 0 && activeCount >= cohort.capacity) {
          results.push({ beneficiaryId: id, outcome: 'COHORT_FULL' });
          continue;
        }

        activeCount++;
        alreadyEnrolledSet.add(id);

        toInsert.push(
          manager.getRepository(CohortMember).create({
            cohortId,
            beneficiaryId: id,
            enrolledAt: new Date(),
            isActive: true,
          }),
        );

        results.push({ beneficiaryId: id, outcome: 'ENROLLED' });
      }

      // 5. Atomic persist
      if (toInsert.length > 0) {
        await manager.getRepository(CohortMember).save(toInsert);
      }

      const enrolledCount = results.filter(
        (r) => r.outcome === 'ENROLLED',
      ).length;

      // 6. Audit Trail
      await this.auditLogService.record({
        actorId,
        actorRole: 'ROLE_SYSADMIN',
        action: 'BULK_COHORT_ENROLLMENT',
        entityType: 'Cohort',
        entityId: cohortId,
        metadata: {
          requested: uniqueIds.length,
          enrolled: enrolledCount,
          outcomes: results,
        },
      });

      return {
        cohortId,
        requested: uniqueIds.length,
        enrolled: enrolledCount,
        skipped: uniqueIds.length - enrolledCount,
        results,
      };
    });
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
      .select([
        'member.id',
        'member.beneficiaryId',
        'member.enrolledAt',
        'member.isActive',
      ])
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
