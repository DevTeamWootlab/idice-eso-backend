// modules/validation/validation.service.ts
import { toValidPercent } from '@/modules/scoring/scoring-weights';
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
import { ScoreCard } from '../scoring/entities/score-card.entity';
import { ApplicationsStateMachineService } from '../applications/applications-state-machine.service';
import { UsersService } from '../users/users.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { NotificationsService } from '../notifications/notifications.service';
import { StorageService } from '../storage/storage.service';
import { ApplicationStatus } from '@/common/enums/application.enum';
import { SubmitValidationDto } from './dto/submit-validation.dto';
import { ResolveVarianceDto } from './dto/resolve-variance.dto';
import { sniffFileType } from '@/common/utils/file-sniff';

const EVIDENCE_TYPES = new Set(['jpg', 'png', 'webp', 'heic', 'heif', 'avif', 'pdf']);

const QUALIFICATION_THRESHOLD = 70.0; // percent — same 70% gate as the ordinary scoring path

@Injectable()
export class ValidationService {
  constructor(
    @InjectRepository(ValidationRecord)
    private readonly validationRepo: Repository<ValidationRecord>,
    @InjectRepository(Application)
    private readonly applicationRepo: Repository<Application>,
    @InjectRepository(ScoreCard)
    private readonly scoreCardRepo: Repository<ScoreCard>,
    private readonly usersService: UsersService,
    private readonly stateMachine: ApplicationsStateMachineService,
    private readonly auditLogService: AuditLogService,
    private readonly notificationsService: NotificationsService,
    private readonly storageService: StorageService,
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
      .where('UPPER(institution.state) = UPPER(:state)', { state: validator.assignedState.trim() })
      .andWhere('application.status IN (:...statuses)', {
        statuses: [
          ApplicationStatus.SHORTLISTED,
          ApplicationStatus.PENDING_ECOSYSTEM_VALIDATION,
          // Score-variance escalations: resolveVariance() below only accepts this
          // status, so if it isn't in the queue a validator has no way to find them.
          ApplicationStatus.PENDING_VALIDATION,
        ],
      })
      .orderBy('application.shortlistedAt', 'ASC')
      .getMany();
  }

  async getDossier(applicationId: string, validatorId: string) {
    const application = await this.assertInScope(applicationId, validatorId);
    // Safe to unblind here unconditionally: this dossier is only ever reachable once
    // an application has left IN_REVIEW_SCORING (SHORTLISTED, PENDING_VALIDATION due
    // to variance, or PENDING_ECOSYSTEM_VALIDATION), i.e. scoring has already
    // finalized one way or another — never while the two reviewers are still blind
    // to each other.
    application.scoreCards = await this.scoreCardRepo.find({
      where: { applicationId },
      relations: { reviewer: true },
    });
    return application;
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
    record.checklist = dto.checklist ?? null;
    const photoFolder = `validation/${applicationId}/photos`;
    const photos = (dto.geotaggedPhotos ?? []).filter((photo) => photo.storageKey?.trim());
    const foreign = photos.filter((photo) => !photo.storageKey.includes(photoFolder));
    if (foreign.length > 0) {
      throw new BadRequestException(
        `${foreign.length} photo(s) were not uploaded for this application. Remove them and upload them again from this page.`,
      );
    }
    record.geotaggedPhotos = photos.map((photo) => ({
      storageKey: photo.storageKey.trim(),
      latitude: photo.latitude,
      longitude: photo.longitude,
      takenAt: photo.takenAt,
      ...(photo.fileName ? { fileName: photo.fileName } : {}),
      ...(photo.contentType ? { contentType: photo.contentType } : {}),
    }));
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

  /**
   * A validator captures a geotagged site-visit photo. Returns a descriptor the
   * frontend accumulates client-side and includes in the final `geotaggedPhotos[]`
   * array passed to submitValidation — mirrors the existing application-document
   * upload flow (upload first, reference the storageKey afterwards), since a
   * ValidationRecord isn't created until the validator actually submits.
   */
  async uploadSiteVisitPhoto(
    applicationId: string,
    validatorId: string,
    file: Express.Multer.File,
    latitude: number,
    longitude: number,
  ) {
    // Confirms the validator is actually in scope for this application before letting
    // them upload anything against it.
    if (!file?.buffer?.length) {
      throw new BadRequestException('Attach the photo or PDF to upload as evidence');
    }
    if (!Number.isFinite(Number(latitude)) || !Number.isFinite(Number(longitude))) {
      throw new BadRequestException('A location is required with every site-visit photo');
    }
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

    const sniffed = sniffFileType(file.buffer);
    if (!sniffed || !EVIDENCE_TYPES.has(sniffed.ext)) {
      throw new BadRequestException(
        'This file does not look like a photo or PDF. Upload a JPEG, PNG, WebP or HEIC photo, or a PDF.',
      );
    }

    const stored = await this.storageService.uploadEvidence(
      file.buffer,
      `validation/${applicationId}/photos`,
      file.originalname,
      sniffed.mime,
    );

    await this.auditLogService.record({
      actorId: validatorId,
      actorRole: 'ROLE_VALIDATOR',
      action: 'FIELD_VALIDATION_EVIDENCE_UPLOADED',
      entityType: 'Application',
      entityId: applicationId,
      metadata: {
        fileName: stored.fileName,
        contentType: stored.contentType,
        sizeBytes: file.size,
        storage: stored.provider,
        latitude: Number(latitude),
        longitude: Number(longitude),
      },
    });

    return {
      storageKey: stored.storageKey,
      fileName: stored.fileName,
      contentType: stored.contentType,
      latitude: Number(latitude),
      longitude: Number(longitude),
      takenAt: new Date().toISOString(),
    };
  }

  /**
   * TC-SCO-04 follow-up — the Validator / Lead Evaluator reconciling a >15% scorer
   * variance. Scoped the same way as field validation itself (assertInScope — the
   * validator's assignedState must match the application's Centre of Excellence), so
   * this stays consistent with the dossier fetch (GET :id/validation) that the
   * frontend loads before showing the reconciliation panel — that fetch is already
   * state-scoped, so resolving the variance has to be too, or an out-of-state
   * validator could never even load the dossier to act on it in the first place.
   */
  async resolveVariance(
    applicationId: string,
    validatorId: string,
    dto: ResolveVarianceDto,
  ) {
    const application = await this.assertInScope(applicationId, validatorId);
    if (application.status !== ApplicationStatus.PENDING_VALIDATION) {
      throw new BadRequestException(
        `Application is in ${application.status} status and does not have a pending score-variance escalation`,
      );
    }

    const reconciledScorePercent = toValidPercent(
      Math.round(Number(dto.reconciledScorePercent) * 100) / 100,
    );
    if (reconciledScorePercent === null) {
      throw new BadRequestException('The reconciled score must be a number between 0 and 100');
    }

    application.finalScorePercent = reconciledScorePercent;
    application.scoreVarianceFlagged = false;
    application.scoreVarianceResolutionNote = dto.note;
    application.scoreVarianceResolvedByUserId = validatorId;
    application.scoreVarianceResolvedAt = new Date();
    await this.applicationRepo.save(application);

    // Same 70% qualification threshold as the ordinary (non-variance) scoring path —
    // a human reconciling the scores doesn't bypass the programme's qualification bar.
    const targetStatus =
      reconciledScorePercent >= QUALIFICATION_THRESHOLD
        ? ApplicationStatus.SHORTLISTED
        : ApplicationStatus.REJECTED;

    await this.stateMachine.transition(applicationId, {
      targetStatus,
      actorId: validatorId,
      role: 'ROLE_VALIDATOR',
      metadata: { reconciledScorePercent, note: dto.note },
    });

    await this.auditLogService.record({
      actorId: validatorId,
      actorRole: 'ROLE_VALIDATOR',
      action:
        targetStatus === ApplicationStatus.SHORTLISTED
          ? 'SCORE_VARIANCE_RESOLVED_SHORTLISTED'
          : 'SCORE_VARIANCE_RESOLVED_REJECTED',
      entityType: 'Application',
      entityId: applicationId,
      metadata: { reconciledScorePercent, note: dto.note },
    });

    if (targetStatus === ApplicationStatus.SHORTLISTED) {
      await this.notificationsService.sendShortlistedNotification(
        application.primaryContactEmail,
        reconciledScorePercent,
        application.applicationRef,
      );
    } else {
      await this.notificationsService.sendDisqualificationNotification(
        application.primaryContactEmail,
        `A Lead Evaluator reconciled the two reviewer scores at ${reconciledScorePercent}%, which did not meet the 70% qualification threshold.`,
        application.applicationRef,
      );
    }

    return this.applicationRepo.findOne({ where: { id: applicationId } });
  }
}
