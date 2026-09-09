import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { randomUUID } from 'crypto';

import { Application } from './entities/application.entity';
import {
  ApplicationDocument,
  DocumentType,
} from './entities/application-document.entity';
import { ApplicationReference } from './entities/application-reference.entity';
import { ApplicationsStateMachineService } from './applications-state-machine.service';
import { ApplicationCompletenessService } from './application-completeness.service';
import { StorageService } from '../storage/storage.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { ApplicationStatus } from '@/common/enums/application.enum';
import { SaveDraftDto } from './dto/save-draft.dto';

const EDITABLE_STATUSES = [
  ApplicationStatus.DRAFT,
  ApplicationStatus.REWORK_REQUIRED,
];

@Injectable()
export class ApplicationsService {
  constructor(
    @InjectRepository(Application)
    private readonly applicationRepo: Repository<Application>,
    @InjectRepository(ApplicationDocument)
    private readonly documentRepo: Repository<ApplicationDocument>,
    @InjectRepository(ApplicationReference)
    private readonly referenceRepo: Repository<ApplicationReference>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly stateMachine: ApplicationsStateMachineService,
    private readonly completenessService: ApplicationCompletenessService,
    private readonly storageService: StorageService,
    private readonly auditLogService: AuditLogService,
  ) {}

  async findMine(userId: string): Promise<Application[]> {
    return this.applicationRepo.find({
      where: { submittedByOrgId: userId },
      order: { createdAt: 'DESC' },
    });
  }

  async findOneOwned(userId: string, id: string): Promise<Application> {
    const application = await this.applicationRepo.findOne({
      where: { id },
      relations: {
        references: true,
        documents: true,
      },
    });
    if (!application) throw new NotFoundException('Application not found');
    if (application.submittedByOrgId !== userId) {
      throw new ForbiddenException(
        'You do not have access to this application',
      );
    }
    return application;
  }

  private async findOrCreateDraft(userId: string): Promise<Application> {
    let application = await this.applicationRepo.findOne({
      where: { submittedByOrgId: userId, status: ApplicationStatus.DRAFT },
      relations: {
        references: true,
        documents: true,
      },
    });

    if (!application) {
      application = this.applicationRepo.create({
        submittedByOrgId: userId,
        applicationRef: `IDICE-NC-${randomUUID().slice(0, 8).toUpperCase()}`,
        status: ApplicationStatus.DRAFT,
      });
      application = await this.applicationRepo.save(application);
    }

    return application;
  }

  /**
   * POST /applications/draft
   * Upserts whatever fields the frontend sends — safe to call repeatedly
   * as the applicant fills in sections in any order, autosave-style.
   */
  async saveDraft(userId: string, dto: SaveDraftDto): Promise<Application> {
    const application = await this.findOrCreateDraft(userId);

    if (!EDITABLE_STATUSES.includes(application.status)) {
      throw new BadRequestException(
        `Application cannot be edited while in ${application.status} status`,
      );
    }

    const { references, ...fields } = dto;
    Object.assign(application, fields);
    application.lastEditedAt = new Date();
    application.lastEditedByUserId = userId;

    await this.applicationRepo.save(application);

    if (references) {
      await this.referenceRepo.delete({ applicationId: application.id });
      const refEntities = references.map((r) =>
        this.referenceRepo.create({ ...r, applicationId: application.id }),
      );
      await this.referenceRepo.save(refEntities);
    }

    return this.findOneOwned(userId, application.id);
  }

  async uploadDocument(
    userId: string,
    id: string,
    documentType: DocumentType,
    file: Express.Multer.File,
  ) {
    const application = await this.findOneOwned(userId, id);
    if (!EDITABLE_STATUSES.includes(application.status)) {
      throw new BadRequestException(
        `Application cannot be edited while in ${application.status} status`,
      );
    }

    const storageKey = await this.storageService.uploadFile(
      file.buffer,
      `applications/${id}/${documentType}`,
      file.originalname,
    );

    const document = this.documentRepo.create({
      applicationId: id,
      documentType,
      storageKey,
      originalFileName: file.originalname,
      mimeType: file.mimetype,
      fileSizeBytes: file.size,
    });

    return this.documentRepo.save(document);
  }

  async downloadDocument(userId: string, id: string, documentId: string) {
    await this.findOneOwned(userId, id);
    const document = await this.documentRepo.findOne({
      where: { id: documentId, applicationId: id },
    });
    if (!document) throw new NotFoundException('Document not found');
    const buffer = await this.storageService.readFile(document.storageKey);
    return { buffer, document };
  }

  async removeDocument(userId: string, id: string, documentId: string) {
    const application = await this.findOneOwned(userId, id);
    if (!EDITABLE_STATUSES.includes(application.status)) {
      throw new BadRequestException(
        `Application cannot be edited while in ${application.status} status`,
      );
    }
    const document = await this.documentRepo.findOne({
      where: { id: documentId, applicationId: id },
    });
    if (!document) throw new NotFoundException('Document not found');

    await this.storageService.deleteFile(document.storageKey);
    await this.documentRepo.remove(document);
    return { message: 'Document removed' };
  }

  async getCompleteness(userId: string, id: string) {
    const application = await this.findOneOwned(userId, id);
    return this.completenessService.check(application);
  }

  /**
   * POST /applications/submit
   *
   * 1. Runs strict completeness validation against Sections A-H + documents.
   * 2. On success: transitions DRAFT/REWORK_REQUIRED -> SUBMITTED,
   *    version increments automatically via @VersionColumn on save.
   */
  async submit(
    userId: string,
    id: string,
    expectedVersion?: number,
  ): Promise<Application> {
    return this.dataSource.transaction(async (manager) => {
      const application = await manager
        .getRepository(Application)
        .createQueryBuilder('application')
        // .setLock('pessimistic_write')
        .setLock('pessimistic_write', undefined, ['application'])
        .leftJoinAndSelect('application.references', 'references')
        .leftJoinAndSelect('application.documents', 'documents')
        .where('application.id = :id', { id })
        .getOne();

      if (!application) {
        throw new NotFoundException('Application not found');
      }
      if (application.submittedByOrgId !== userId) {
        throw new ForbiddenException(
          'You do not have access to this application',
        );
      }
      if (!EDITABLE_STATUSES.includes(application.status)) {
        throw new BadRequestException(
          `Application is already in ${application.status} status and cannot be submitted again`,
        );
      }

      if (
        expectedVersion !== undefined &&
        application.version !== expectedVersion
      ) {
        throw new ConflictException(
          'This application was modified elsewhere since you last loaded it. Please refresh and try again.',
        );
      }

      const { complete, missing } = this.completenessService.check(application);
      if (!complete) {
        throw new UnprocessableEntityException({
          message: 'Application is incomplete and cannot be submitted',
          missing,
        });
      }

      const fromStatus = application.status;
      application.status = ApplicationStatus.SUBMITTED;
      application.submittedAt = new Date();

      const saved = await manager.save(application); // version increments here via @VersionColumn

      await this.auditLogService.record({
        actorId: userId,
        actorRole: 'ROLE_ESO',
        action: 'APPLICATION_SUBMITTED',
        entityType: 'Application',
        entityId: id,
        metadata: {
          from: fromStatus,
          to: ApplicationStatus.SUBMITTED,
          newVersion: saved.version,
        },
      });

      return saved;
    });
  }
}
