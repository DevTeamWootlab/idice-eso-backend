import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { DataSource, Repository, SelectQueryBuilder } from 'typeorm';
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
import { ApplicationStatus } from '@/common/enums/application.enum';
import { SaveDraftDto } from './dto/save-draft.dto';
import { ReviewerQueueType } from '@/common/enums/reviewer.enum';

import { ReviewerAssignment } from './entities/reviewer-assignment.entity';
import { Role } from '../../common/enums/role.enum';
import { AuditLogService } from '@/modules/audit-log/audit-log.service';
import { UsersService } from '@/modules/users/users.service';
import { JwtPayload } from '@/common/interfaces/jwt-payload.interface';
import { ListAdminApplicationsDto } from './dto/list-admin-applications.dto';
import { toApplicantActivity } from './applicant-activity';
import {
  ADMIN_LIST_COLUMNS,
  buildStatusCounts,
  clampPagination,
  escapeLikePattern,
  parseStatusFilter,
  totalPagesFor,
} from './admin-applications.query';
import { Match } from '@/modules/matching/entities/match.entity';
import { NotificationsService } from '@/modules/notifications/notifications.service';

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
    @InjectRepository(ReviewerAssignment)
    private readonly reviewerAssignmentRepo: Repository<ReviewerAssignment>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly stateMachine: ApplicationsStateMachineService,
    private readonly completenessService: ApplicationCompletenessService,
    private readonly storageService: StorageService,
    private readonly auditLogService: AuditLogService,
    private readonly usersService: UsersService,
    private readonly notificationsService: NotificationsService,
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

  /**
   * SYSADMIN-only equivalent of findOneOwned with no ownership check — there was
   * previously no endpoint at all for an admin to fetch a single application's full
   * details (only the reviewer-assignment sub-routes existed).
   */
  async findOneForAdmin(id: string): Promise<Application> {
    const application = await this.applicationRepo.findOne({
      where: { id },
      relations: {
        references: true,
        documents: true,
        preferredInstitution: true,
        // SYSADMIN sees everything — always safe to unblind here, unlike the
        // in-progress scoring reviewer's own dossier view.
        scoreCards: { reviewer: true },
      },
    });
    if (!application) throw new NotFoundException('Application not found');
    return application;
  }

  /**
   * SYSADMIN-only paginated list. Backs GET /internal/admin/applications — previously
   * only the single-application-by-ID route existed, so an administrator had no way to
   * browse, search, or count applications at all.
   *
   * DRAFT applications are excluded unless the caller asks for them explicitly via
   * ?status=DRAFT: an unsubmitted draft is the applicant's private work in progress and
   * would otherwise inflate "total applications".
   */
  async listForAdmin(query: ListAdminApplicationsDto) {
    const { page, limit, skip } = clampPagination(query.page, query.limit);

    const { valid, invalid } = parseStatusFilter(query.status);
    if (invalid.length > 0) {
      throw new BadRequestException(
        `Unknown application status: ${invalid.join(', ')}`,
      );
    }

    const qb = this.applicationRepo
      .createQueryBuilder('application')
      .leftJoin('application.preferredInstitution', 'institution')
      .select(ADMIN_LIST_COLUMNS.map((column) => `application.${column}`))
      .addSelect(['institution.id', 'institution.name', 'institution.state']);

    if (valid.length > 0) {
      qb.where('application.status IN (:...statuses)', { statuses: valid });
    } else {
      qb.where('application.status != :draft', {
        draft: ApplicationStatus.DRAFT,
      });
    }

    if (query.state) {
      qb.andWhere(':state = ANY(application.statesOfOperation)', {
        state: query.state,
      });
    }

    const term = query.search?.trim();
    if (term) {
      qb.andWhere(
        '(application.organisationLegalName ILIKE :term OR application.applicationRef ILIKE :term)',
        { term: `%${escapeLikePattern(term)}%` },
      );
    }

    // The only join is to-one (preferredInstitution), so offset/limit cannot
    // multiply or truncate rows.
    const [items, total] = await qb
      .orderBy('application.updated_at', 'DESC')
      .addOrderBy('application.id', 'ASC')
      .offset(skip)
      .limit(limit)
      .getManyAndCount();

    return { items, total, page, limit, totalPages: totalPagesFor(total, limit) };
  }

  /** SYSADMIN-only funnel counts. Backs GET /internal/admin/applications/stats. */
  async getAdminStats() {
    const rows = await this.applicationRepo
      .createQueryBuilder('application')
      .select('application.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .groupBy('application.status')
      .getRawMany<{ status: string; count: string }>();

    const awaitingReviewerAssignment = await this.applicationRepo
      .createQueryBuilder('application')
      .where('application.status = :status', {
        status: ApplicationStatus.IN_REVIEW_SCORING,
      })
      .andWhere((qb: SelectQueryBuilder<Application>) => {
        const assigned = qb
          .subQuery()
          .select('COUNT(*)')
          .from(ReviewerAssignment, 'ra')
          .where('ra.applicationId = application.id')
          .andWhere('ra.queueType = :scoringQueue')
          .getQuery();
        return `${assigned} < 2`;
      })
      .setParameter('scoringQueue', ReviewerQueueType.SCORING)
      .getCount();

    return { ...buildStatusCounts(rows), awaitingReviewerAssignment };
  }

  /** Applicant-safe timeline: whitelisted milestones only (see applicant-activity.ts). */
  async getApplicantActivity(userId: string, id: string) {
    await this.findOneOwned(userId, id);
    const rows = await this.auditLogService.findForEntity('Application', id);
    return toApplicantActivity(rows);
  }

  /**
   * The applicant's confirmed host institution. Nothing is returned until the
   * application is MATCHED, and never the match score or its breakdown.
   */
  async getApplicantMatch(userId: string, id: string) {
    const application = await this.findOneOwned(userId, id);
    if (application.status !== ApplicationStatus.MATCHED) {
      return { matched: false, matchedAt: null, institution: null };
    }
    const match = await this.dataSource
      .getRepository(Match)
      .findOne({ where: { applicationId: id }, relations: { institution: true } });
    return {
      matched: true,
      matchedAt: match?.matchedAt ? new Date(match.matchedAt).toISOString() : null,
      institution: match?.institution
        ? {
            name: match.institution.name,
            state: match.institution.state,
            hubType: match.institution.hubType,
          }
        : null,
    };
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

  async listReviewerAssignments(applicationId: string) {
    const application = await this.applicationRepo.findOne({
      where: { id: applicationId },
    });
    if (!application) throw new NotFoundException('Application not found');

    return this.reviewerAssignmentRepo.find({
      where: { applicationId },
      relations: {
        reviewer: true,
      },
      order: { assignedAt: 'ASC' },
    });
  }

  async assignScoringReviewers(
    applicationId: string,
    reviewerIds: string[],
    actorId: string,
  ) {
    const application = await this.applicationRepo.findOne({
      where: { id: applicationId },
    });
    if (!application) throw new NotFoundException('Application not found');

    if (application.status !== ApplicationStatus.IN_REVIEW_SCORING) {
      throw new BadRequestException(
        `Application is in ${application.status} status — scoring reviewers can only be assigned once eligibility has passed`,
      );
    }

    if (reviewerIds[0] === reviewerIds[1]) {
      throw new BadRequestException(
        'The two scoring reviewers must be different people',
      );
    }

    for (const reviewerId of reviewerIds) {
      const reviewer = await this.usersService.findById(reviewerId);
      if (!reviewer) {
        throw new NotFoundException(`Reviewer ${reviewerId} not found`);
      }
      if (reviewer.role !== Role.SCORING_REVIEWER) {
        throw new BadRequestException(
          `User ${reviewer.email} does not hold the Scoring Reviewer role`,
        );
      }
      if (!reviewer.isActive) {
        throw new BadRequestException(
          `User ${reviewer.email} is not an active account`,
        );
      }
    }

    const existing = await this.reviewerAssignmentRepo.find({
      where: { applicationId, queueType: ReviewerQueueType.SCORING },
    });
    if (existing.length > 0) {
      throw new BadRequestException(
        'Scoring reviewers are already assigned for this application — use the reassign endpoint to replace one',
      );
    }

    const assignments = reviewerIds.map((reviewerId) =>
      this.reviewerAssignmentRepo.create({
        applicationId,
        reviewerId,
        queueType: ReviewerQueueType.SCORING,
        assignedAt: new Date(),
      }),
    );
    const saved = await this.reviewerAssignmentRepo.save(assignments);

    await this.auditLogService.record({
      actorId,
      actorRole: 'ROLE_SYSADMIN',
      action: 'SCORING_REVIEWERS_ASSIGNED',
      entityType: 'Application',
      entityId: applicationId,
      metadata: { reviewerIds },
    });

    await Promise.all(
      reviewerIds.map((reviewerId) =>
        this.notificationsService.notifyUser(
          reviewerId,
          'New scoring assignment',
          `You have been assigned to score ${application.organisationLegalName || application.applicationRef}.`,
          `/internal/applications/${applicationId}`,
        ),
      ),
    );

    return saved;
  }

  async reassignScoringReviewer(
    applicationId: string,
    outgoingReviewerId: string,
    incomingReviewerId: string,
    actorId: string,
  ) {
    const assignment = await this.reviewerAssignmentRepo.findOne({
      where: {
        applicationId,
        reviewerId: outgoingReviewerId,
        queueType: ReviewerQueueType.SCORING,
      },
    });
    if (!assignment) {
      throw new NotFoundException(
        'The outgoing reviewer is not assigned to this application',
      );
    }
    if (assignment.completed) {
      throw new BadRequestException(
        'This reviewer has already submitted a score — reassignment is not permitted after submission, since it would compromise the blind dual-review integrity',
      );
    }

    const incomingReviewer =
      await this.usersService.findById(incomingReviewerId);
    if (!incomingReviewer || incomingReviewer.role !== Role.SCORING_REVIEWER) {
      throw new BadRequestException(
        'The incoming reviewer must be an active Scoring Reviewer account',
      );
    }

    const otherAssignment = await this.reviewerAssignmentRepo.findOne({
      where: { applicationId, queueType: ReviewerQueueType.SCORING },
      order: { assignedAt: 'ASC' },
    });
    if (otherAssignment && otherAssignment.reviewerId === incomingReviewerId) {
      throw new BadRequestException(
        'The incoming reviewer is already assigned as the other scorer on this application',
      );
    }

    assignment.reviewerId = incomingReviewerId;
    assignment.assignedAt = new Date();
    const saved = await this.reviewerAssignmentRepo.save(assignment);

    await this.auditLogService.record({
      actorId,
      actorRole: 'ROLE_SYSADMIN',
      action: 'SCORING_REVIEWER_REASSIGNED',
      entityType: 'Application',
      entityId: applicationId,
      metadata: { outgoingReviewerId, incomingReviewerId },
    });

    await this.notificationsService.notifyUser(
      incomingReviewerId,
      'New scoring assignment',
      'You have been assigned an application to score.',
      `/internal/applications/${applicationId}`,
    );

    return saved;
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

  /**
   * Checks whether `user` (an internal reviewer role) is allowed to see this
   * application's dossier/documents/audit trail at all, using the same scoping each
   * role's own queue already enforces:
   * - ROLE_ELIGIBILITY_REVIEWER: unrestricted, same as EligibilityService's queue/dossier.
   * - ROLE_SCORING_REVIEWER: only the two reviewers actually assigned to score it.
   * - ROLE_VALIDATOR: only the validator whose assignedState matches the application's
   *   preferredInstitution.state, same as ValidationService.assertInScope.
   * - ROLE_SYSADMIN: unrestricted.
   */
  private async assertReviewerCanAccess(
    application: Application,
    user: JwtPayload,
  ): Promise<void> {
    if (user.role === Role.SYSADMIN || user.role === Role.ELIGIBILITY_REVIEWER) {
      return;
    }
    if (user.role === Role.SCORING_REVIEWER) {
      const assignment = await this.reviewerAssignmentRepo.findOne({
        where: {
          applicationId: application.id,
          reviewerId: user.sub,
          queueType: ReviewerQueueType.SCORING,
        },
      });
      if (!assignment) {
        throw new ForbiddenException(
          'You are not assigned to score this application',
        );
      }
      return;
    }
    if (user.role === Role.VALIDATOR) {
      const validator = await this.usersService.findById(user.sub);
      if (
        !validator?.assignedState ||
        application.preferredInstitution?.state?.trim().toUpperCase() !==
          validator.assignedState.trim().toUpperCase()
      ) {
        throw new ForbiddenException(
          'This application is outside your assigned state',
        );
      }
      return;
    }
    throw new ForbiddenException('You do not have access to this application');
  }

  /**
   * Reviewer-facing document download (eligibility/scoring/validation/sysadmin) — the
   * only download route that previously existed (ApplicationsController's) was
   * ROLE_ESO-only with an ownership check, so no internal reviewer could ever open a
   * document they were supposed to be auditing (TC-ELI-02).
   */
  async getDocumentForReviewer(
    applicationId: string,
    documentId: string,
    user: JwtPayload,
  ) {
    const application = await this.applicationRepo.findOne({
      where: { id: applicationId },
      relations: { preferredInstitution: true },
    });
    if (!application) throw new NotFoundException('Application not found');
    await this.assertReviewerCanAccess(application, user);

    const document = await this.documentRepo.findOne({
      where: { id: documentId, applicationId },
    });
    if (!document) throw new NotFoundException('Document not found');
    const buffer = await this.storageService.readFile(document.storageKey);
    return { buffer, document };
  }

  /** Backs the "Audit trail" panel on the internal application detail page. */
  async getAuditLogForReviewer(applicationId: string, user: JwtPayload) {
    const application = await this.applicationRepo.findOne({
      where: { id: applicationId },
      relations: { preferredInstitution: true },
    });
    if (!application) throw new NotFoundException('Application not found');
    await this.assertReviewerCanAccess(application, user);
    return this.auditLogService.findForEntity('Application', applicationId);
  }
}
