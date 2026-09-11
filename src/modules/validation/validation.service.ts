// modules/validation/validation.service.ts
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ValidationRecord } from './entities/validation-record.entity';
import { Application } from '../applications/entities/application.entity';
import { ApplicationsStateMachineService } from '../applications/applications-state-machine.service';
import { UsersService } from '../users/users.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { ApplicationStatus } from '@/common/enums/application.enum';
import { SubmitValidationDto } from './dto/submit-validation.dto';

@Injectable()
export class ValidationService {
  constructor(
    @InjectRepository(ValidationRecord)
    private readonly validationRepo: Repository<ValidationRecord>,
    @InjectRepository(Application)
    private readonly applicationRepo: Repository<Application>,
    private readonly usersService: UsersService,
    private readonly stateMachine: ApplicationsStateMachineService,
    private readonly auditLogService: AuditLogService,
  ) {}

  /**
   * TC-VAL-01 — routing anchor is the application's preferredInstitution.state,
   * not the ESO's self-declared statesOfOperation. An application is validated
   * against the specific Centre of Excellence it applied to, which has exactly
   * one state — this matches the E_loc = I_loc constraint the Partner Match
   * Engine uses later, so validation and matching stay consistent with each other.
   *
   * Filtering happens in the query itself (INNER JOIN + WHERE), not a
   * post-fetch filter — so a validator's queue can never even momentarily
   * contain another state's applications.
   */
  async getQueue(validatorId: string) {
    const validator = await this.usersService.findById(validatorId);
    if (!validator?.assignedState) {
      throw new ForbiddenException(
        'Your account has no assigned state — contact an administrator',
      );
    }

    return this.applicationRepo
      .createQueryBuilder('application')
      .innerJoinAndSelect('application.preferredInstitution', 'institution')
      .where('institution.state = :state', { state: validator.assignedState })
      .andWhere('application.status IN (:...statuses)', {
        statuses: [
          ApplicationStatus.SHORTLISTED,
          ApplicationStatus.PENDING_ECOSYSTEM_VALIDATION,
        ],
      })
      .orderBy('application.shortlistedAt', 'ASC')
      .getMany();
  }

  async getDossier(applicationId: string, validatorId: string) {
    return this.assertInScope(applicationId, validatorId);
  }

  private async assertInScope(
    applicationId: string,
    validatorId: string,
  ): Promise<Application> {
    const validator = await this.usersService.findById(validatorId);
    if (!validator?.assignedState) {
      throw new ForbiddenException(
        'Your account has no assigned state — contact an administrator',
      );
    }

    const application = await this.applicationRepo.findOne({
      where: { id: applicationId },
      relations: {
        preferredInstitution: true,
        references: true,
        documents: true,
      },
    });

    if (!application) {
      throw new NotFoundException('Application not found');
    }

    if (!application.preferredInstitution) {
      throw new BadRequestException(
        'This application has no assigned Centre of Excellence and cannot be routed for validation',
      );
    }
    console.log(
      'application.preferredInstitution.state, validator.assignedState',
      application.preferredInstitution.state,
      validator.assignedState,
    );
    if (
      application.preferredInstitution?.state?.trim().toUpperCase() !==
      validator.assignedState?.trim().toUpperCase()
    ) {
      throw new ForbiddenException(
        'This application is outside your assigned state',
      );
    }

    return application;
  }

  /**
   * TC-VAL-02
   */
  async submitValidation(
    applicationId: string,
    validatorId: string,
    dto: SubmitValidationDto,
  ) {
    const application = await this.assertInScope(applicationId, validatorId);

    if (
      ![
        ApplicationStatus.SHORTLISTED,
        ApplicationStatus.PENDING_ECOSYSTEM_VALIDATION,
      ].includes(application.status)
    ) {
      throw new BadRequestException(
        `Application is in ${application.status} status and is not awaiting field validation`,
      );
    }

    let record = await this.validationRepo.findOne({
      where: { applicationId },
    });
    if (!record) {
      record = this.validationRepo.create({ applicationId, validatorId });
    }
    const siteInspectionNotes =
      dto.siteInspectionNotes ??
      'No site inspection notes provided by the validator';

    record.siteInspectionNotes = siteInspectionNotes;
    record.geotaggedPhotos = dto.geotaggedPhotos as any;
    record.physicalFootprintVerified = dto.physicalFootprintVerified;
    record.validatedAt = new Date();
    record.validatorId = validatorId;
    await this.validationRepo.save(record);

    await this.auditLogService.record({
      actorId: validatorId,
      actorRole: 'ROLE_VALIDATOR',
      action: 'FIELD_VALIDATION_SUBMITTED',
      entityType: 'Application',
      entityId: applicationId,
      metadata: {
        physicalFootprintVerified: dto.physicalFootprintVerified,
        validationRecordId: record.id,
      },
    });

    if (dto.physicalFootprintVerified) {
      await this.stateMachine.transition(applicationId, {
        targetStatus: ApplicationStatus.VALIDATED_SHORTLISTED,
        actorId: validatorId,
        role: 'ROLE_VALIDATOR',
        metadata: { validationRecordId: record.id },
      });
    }
    return record;
  }
}
