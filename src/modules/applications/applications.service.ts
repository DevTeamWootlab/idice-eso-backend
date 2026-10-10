import { ExportAdminApplicationsDto } from './dto/export-admin-applications.dto';
import { toCsv } from '@/common/utils/csv';
import { buildXlsx } from '@/common/utils/xlsx';
import { buildPdf } from '@/common/utils/pdf';

import { User } from '@/modules/users/entities/user.entity';
import { ScoreCard } from '@/modules/scoring/entities/score-card.entity';
import { browserSafeCloudinaryUrl } from '@/modules/storage/cloudinary.client';
import { sniffFileType, withExtension } from '@/common/utils/file-sniff';
import { EligibilityChecklist } from '@/modules/eligibility/entities/eligibility-checklist.entity';
import { toValidPercent } from '@/modules/scoring/scoring-weights';
import { ValidationRecord } from '@/modules/validation/entities/validation-record.entity';
import { resolveContentType, resolveFileName } from '@/common/utils/content-disposition';
import { applicationLabel } from './application-label';
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
import { Match, MatchStatus } from '@/modules/matching/entities/match.entity';
import { BeneficiariesService } from '@/modules/beneficiaries/beneficiaries.service';
import { NotificationsService } from '@/modules/notifications/notifications.service';
import { validateReviewerPair, validateReassignSlot } from '@/modules/users/user-rules';

const EDITABLE_STATUSES = [
  ApplicationStatus.DRAFT,
  ApplicationStatus.REWORK_REQUIRED,
];

const PROXIMITY_EXPORT_LABELS: Record<string, string> = {
  LESS_THAN_15_MINS: 'Less than 15 minutes',
  BETWEEN_15_30_MINS: '15 to 30 minutes',
  OVER_30_MINS: 'More than 30 minutes',
};

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
    private readonly beneficiariesService: BeneficiariesService,
  ) {}

  async getReviewerActivity() {
    const manager = this.applicationRepo.manager;
    const users = await manager.getRepository(User).find({
      where: [
        { role: Role.SCORING_REVIEWER },
        { role: Role.ELIGIBILITY_REVIEWER },
        { role: Role.VALIDATOR },
      ],
      order: { fullName: 'ASC' },
    });

    const assignments = (await this.reviewerAssignmentRepo
      .createQueryBuilder('a')
      .innerJoin('a.application', 'app')
      .select('a.reviewerId', 'reviewerId')
      .addSelect('COUNT(*)', 'assigned')
      .addSelect(
        `SUM(CASE WHEN a.completed = false AND app.status = :scoring THEN 1 ELSE 0 END)`,
        'pending',
      )
      .where('a.queueType = :queueType', { queueType: ReviewerQueueType.SCORING })
      .setParameter('scoring', ApplicationStatus.IN_REVIEW_SCORING)
      .groupBy('a.reviewerId')
      .getRawMany()) as { reviewerId: string; assigned: string; pending: string }[];

    const cards = (await manager
      .getRepository(ScoreCard)
      .createQueryBuilder('c')
      .select('c.reviewerId', 'reviewerId')
      .addSelect('COUNT(*)', 'submitted')
      .addSelect('AVG(c.compositePercentage)', 'averageScore')
      .addSelect('MAX(c.submittedAt)', 'lastActivity')
      .where('c.submitted = true')
      .groupBy('c.reviewerId')
      .getRawMany()) as { reviewerId: string; submitted: string; averageScore: string | null; lastActivity: string | null }[];

    const checklists = (await manager
      .getRepository(EligibilityChecklist)
      .createQueryBuilder('e')
      .select('e.reviewerId', 'reviewerId')
      .addSelect('COUNT(*)', 'decisions')
      .addSelect(`SUM(CASE WHEN e.overallResult = 'PASS' THEN 1 ELSE 0 END)`, 'passed')
      .addSelect('MAX(e.createdAt)', 'lastActivity')
      .groupBy('e.reviewerId')
      .getRawMany()) as { reviewerId: string; decisions: string; passed: string; lastActivity: string | null }[];

    const validations = (await manager
      .getRepository(ValidationRecord)
      .createQueryBuilder('v')
      .select('v.validatorId', 'reviewerId')
      .addSelect('COUNT(*)', 'completed')
      .addSelect('MAX(COALESCE(v.validatedAt, v.createdAt))', 'lastActivity')
      .groupBy('v.validatorId')
      .getRawMany()) as { reviewerId: string; completed: string; lastActivity: string | null }[];

    const byId = <T extends { reviewerId: string }>(rows: T[]) => new Map(rows.map((row) => [row.reviewerId, row]));
    const assignmentMap = byId(assignments);
    const cardMap = byId(cards);
    const checklistMap = byId(checklists);
    const validationMap = byId(validations);
    const num = (value: string | number | null | undefined) => (value === null || value === undefined ? 0 : Number(value));
    const pct = (value: string | null | undefined) => {
      const n = toValidPercent(value);
      return n === null ? null : Math.round(n * 10) / 10;
    };

    const scoring = users
      .filter((u) => u.role === Role.SCORING_REVIEWER)
      .map((u) => {
        const a = assignmentMap.get(u.id);
        const c = cardMap.get(u.id);
        return {
          userId: u.id,
          fullName: u.fullName,
          active: u.isActive,
          slot: u.scoringSlot ?? null,
          assigned: num(a?.assigned),
          submitted: num(c?.submitted),
          pending: num(a?.pending),
          averageScore: pct(c?.averageScore),
          lastActivity: c?.lastActivity ?? null,
        };
      });
    const eligibility = users
      .filter((u) => u.role === Role.ELIGIBILITY_REVIEWER)
      .map((u) => {
        const e = checklistMap.get(u.id);
        const decisions = num(e?.decisions);
        return {
          userId: u.id,
          fullName: u.fullName,
          active: u.isActive,
          decisions,
          passed: num(e?.passed),
          failed: decisions - num(e?.passed),
          lastActivity: e?.lastActivity ?? null,
        };
      });
    const validation = users
      .filter((u) => u.role === Role.VALIDATOR)
      .map((u) => {
        const v = validationMap.get(u.id);
        return {
          userId: u.id,
          fullName: u.fullName,
          active: u.isActive,
          state: u.assignedState ?? null,
          completed: num(v?.completed),
          lastActivity: v?.lastActivity ?? null,
        };
      });

    return {
      scoring,
      eligibility,
      validation,
      totals: {
        scoresSubmitted: scoring.reduce((sum, r) => sum + r.submitted, 0),
        scoresPending: scoring.reduce((sum, r) => sum + r.pending, 0),
        eligibilityDecisions: eligibility.reduce((sum, r) => sum + r.decisions, 0),
        validationsCompleted: validation.reduce((sum, r) => sum + r.completed, 0),
      },
    };
  }

  async getValidationRecordForAdmin(applicationId: string) {
    const application = await this.applicationRepo.findOne({ where: { id: applicationId }, select: { id: true } });
    if (!application) throw new NotFoundException('Application not found');
    const record = await this.applicationRepo.manager.getRepository(ValidationRecord).findOne({
      where: { applicationId },
      relations: { validator: true },
      order: { createdAt: 'DESC' },
    });
    if (!record) return null;
    return {
      id: record.id,
      validatorName: record.validator?.fullName ?? null,
      validatedAt: record.validatedAt ?? null,
      notes: record.siteInspectionNotes ?? null,
      checklist: record.checklist ?? [],
      physicalFootprintVerified: record.physicalFootprintVerified,
      photos: (record.geotaggedPhotos ?? []).map((photo, index) => ({
        index,
        latitude: photo.latitude,
        longitude: photo.longitude,
        takenAt: photo.takenAt ?? null,
        fileName: resolveFileName(photo.fileName ?? null, browserSafeCloudinaryUrl(photo.storageKey)),
        contentType: resolveContentType(photo.contentType ?? null, browserSafeCloudinaryUrl(photo.storageKey)),
      })),
    };
  }

  async getValidationPhotoForAdmin(applicationId: string, index: number) {
    const record = await this.applicationRepo.manager.getRepository(ValidationRecord).findOne({
      where: { applicationId },
      order: { createdAt: 'DESC' },
    });
    const photo = record?.geotaggedPhotos?.[index];
    if (!photo?.storageKey) throw new NotFoundException('Photo not found');
    const source = browserSafeCloudinaryUrl(photo.storageKey);
    const buffer = await this.storageService.readFile(source);
    const sniffed = sniffFileType(buffer);
    const fileName = resolveFileName(photo.fileName ?? null, source);
    return {
      buffer,
      fileName: sniffed ? withExtension(fileName, sniffed.ext) : fileName,
      contentType: sniffed?.mime ?? resolveContentType(photo.contentType ?? null, source),
    };
  }

  async findMine(userId: string): Promise<Application[]> {
    const applications = await this.applicationRepo.find({
      where: { submittedByOrgId: userId },
      order: { createdAt: 'DESC' },
    });
    return applications.map((application) => this.withoutInternalNotes(application));
  }

  private withoutInternalNotes(application: Application): Application {
    (application as Partial<Application>).scoringIntegrityError = undefined;
    return application;
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
    return this.withoutInternalNotes(application);
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

  async exportApplications(query: ExportAdminApplicationsDto) {
    const { valid, invalid } = parseStatusFilter(query.status);
    if (invalid.length > 0) {
      throw new BadRequestException(`Unknown application status: ${invalid.join(', ')}`);
    }

    const qb = this.applicationRepo
      .createQueryBuilder('application')
      .leftJoinAndSelect('application.preferredInstitution', 'institution')
      .leftJoinAndSelect('application.scoreCards', 'card', 'card.submitted = true');
    if (valid.length > 0) {
      qb.where('application.status IN (:...statuses)', { statuses: valid });
    } else {
      qb.where('application.status != :draft', { draft: ApplicationStatus.DRAFT });
    }
    if (query.state) {
      qb.andWhere(':state = ANY(application.statesOfOperation)', { state: query.state });
    }
    const term = query.search?.trim();
    if (term) {
      qb.andWhere(
        '(application.organisationLegalName ILIKE :term OR application.applicationRef ILIKE :term)',
        { term: `%${escapeLikePattern(term)}%` },
      );
    }
    const applications = await qb
      .orderBy('application.submittedAt', 'DESC', 'NULLS LAST')
      .addOrderBy('application.applicationRef', 'ASC')
      .getMany();

    const label = (value: string | null | undefined) =>
      value
        ? value
            .toLowerCase()
            .split('_')
            .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ')
        : '';
    const date = (value: Date | string | null | undefined) =>
      value ? new Date(value).toISOString().slice(0, 16).replace('T', ' ') : '';
    const score = (value: unknown) => {
      const n = toValidPercent(value);
      return n === null ? null : Math.round(n * 100) / 100;
    };

    const header = [
      'Reference',
      'Organisation',
      'Organisation type',
      'Registration type',
      'Year established',
      'States of operation',
      'Preferred host institution',
      'Proximity to host',
      'Sector focus',
      'Contact name',
      'Contact email',
      'Contact phone',
      'Status',
      'Submitted (UTC)',
      'Reviewer 1 score %',
      'Reviewer 2 score %',
      'Final score %',
      'Score gap flagged',
      'Scoring issue',
    ];
    const rows = applications.map((app) => {
      const cards = [...(app.scoreCards ?? [])].sort((a, b) => (a.reviewerSlot ?? 0) - (b.reviewerSlot ?? 0));
      return [
        app.applicationRef,
        app.organisationLegalName ?? '',
        label(app.organisationType),
        label(app.registrationType),
        app.yearEstablished ?? null,
        (app.statesOfOperation ?? []).map(label).join('; '),
        app.preferredInstitution?.name ?? '',
        PROXIMITY_EXPORT_LABELS[app.proximityToHostInstitution ?? ''] ?? '',
        (app.sectorFocus ?? []).map(label).join('; '),
        app.primaryContactName ?? '',
        app.primaryContactEmail ?? '',
        app.primaryContactPhone ?? '',
        label(app.status),
        date(app.submittedAt),
        score(cards[0]?.compositePercentage),
        score(cards[1]?.compositePercentage),
        score(app.finalScorePercent),
        app.scoreVarianceFlagged ? 'Yes' : 'No',
        app.scoringIntegrityError ?? '',
      ];
    });

    const stamp = new Date().toISOString().slice(0, 10);
    const filters = [
      valid.length > 0 ? `Statuses: ${valid.map(label).join(', ')}` : 'Statuses: all submitted',
      query.state ? `State: ${label(query.state)}` : null,
      term ? `Search: ${term}` : null,
    ].filter(Boolean) as string[];

    if (query.format === 'csv') {
      return {
        buffer: Buffer.from(toCsv([header, ...rows]), 'utf8'),
        contentType: 'text/csv; charset=utf-8',
        fileName: `eso-applications-${stamp}.csv`,
      };
    }
    if (query.format === 'xlsx') {
      return {
        buffer: buildXlsx([
          {
            name: 'Applications',
            rows: [header, ...rows],
            boldRows: [0],
            columnWidths: [22, 36, 26, 20, 10, 28, 36, 20, 30, 24, 32, 18, 26, 18, 12, 12, 12, 12, 40],
          },
        ]),
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        fileName: `eso-applications-${stamp}.xlsx`,
      };
    }
    const pdfColumns = ['Reference', 'Organisation', 'State', 'Type', 'Status', 'Submitted', 'Final %'];
    const pdfRows = rows.map((row) => [row[0], row[1], row[5], row[2], row[12], String(row[13]).slice(0, 10), row[16]]);
    return {
      buffer: buildPdf({
        title: 'ESO applications',
        subtitle: `Generated ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC · ${rows.length} applications`,
        footer: 'iDICE North Central ESO Portal',
        sections: [
          { heading: 'Filters', lines: filters },
          { heading: 'Applications', table: { columns: pdfColumns, rows: pdfRows } },
        ],
      }),
      contentType: 'application/pdf',
      fileName: `eso-applications-${stamp}.pdf`,
    };
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

  /**
   * Correction: a beneficiary must be visible to (and only to) the specific ESO
   * matched — and committed — to the Centre of Excellence that beneficiary was
   * actually allocated to, and only once the ESO matching process has produced that
   * commitment. Resolves institutionId from this ESO's own ACCEPTED Match record —
   * never from anything the client supplies — so there is no way for one ESO to see
   * another's cohort by passing a different institution. Uses the same MATCHED gate
   * as getApplicantMatch above: an application that hasn't been committed yet gets a
   * 403, not an empty list, so the difference between "not matched yet" and "matched,
   * nobody allocated yet" stays visible to the caller.
   */
  async getApplicantBeneficiaries(userId: string, id: string) {
    const application = await this.findOneOwned(userId, id);
    if (application.status !== ApplicationStatus.MATCHED) {
      throw new ForbiddenException(
        'This application has not been matched to a Centre of Excellence yet',
      );
    }
    const match = await this.dataSource
      .getRepository(Match)
      .findOne({ where: { applicationId: id, status: MatchStatus.ACCEPTED } });
    if (!match) {
      throw new ForbiddenException(
        'This application has not been matched to a Centre of Excellence yet',
      );
    }
    return this.beneficiariesService.listForEso(match.institutionId);
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

    const found = await Promise.all(reviewerIds.map((id) => this.usersService.findById(id)));
    const pairProblem = validateReviewerPair(
      reviewerIds,
      found.flatMap((r) =>
        r
          ? [{ id: r.id, email: r.email, role: r.role, isActive: r.isActive, scoringSlot: r.scoringSlot ?? null }]
          : [],
      ),
    );
    if (pairProblem) throw new BadRequestException(pairProblem);

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
          `You have been assigned to score ${applicationLabel(application)}. Your score stays hidden from the other reviewer until you both submit.`,
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
    if (
      !incomingReviewer ||
      incomingReviewer.role !== Role.SCORING_REVIEWER ||
      !incomingReviewer.isActive
    ) {
      throw new BadRequestException(
        'The incoming reviewer must be an active Scoring Reviewer account',
      );
    }
    if (incomingReviewerId === outgoingReviewerId) {
      throw new BadRequestException(
        'Choose a different reviewer to take over this application',
      );
    }
    const outgoingReviewer = await this.usersService.findById(outgoingReviewerId);
    const slotProblem = validateReassignSlot(
      outgoingReviewer?.scoringSlot ?? null,
      incomingReviewer.scoringSlot ?? null,
    );
    if (slotProblem) throw new BadRequestException(slotProblem);

    const otherAssignment = await this.reviewerAssignmentRepo.findOne({
      where: {
        applicationId,
        reviewerId: incomingReviewerId,
        queueType: ReviewerQueueType.SCORING,
      },
    });
    if (otherAssignment) {
      throw new BadRequestException(
        'The incoming reviewer is already assigned as the other scorer on this application',
      );
    }

    await this.dataSource.getRepository(ScoreCard).delete({
      applicationId,
      reviewerId: outgoingReviewerId,
      submitted: false,
    } as any);
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

    const reassigned = await this.applicationRepo.findOne({
      where: { id: applicationId },
      select: { id: true, applicationRef: true, organisationLegalName: true },
    });
    await this.notificationsService.notifyUser(
      incomingReviewerId,
      'New scoring assignment',
      `You have been assigned to score ${applicationLabel(reassigned ?? { id: applicationId })}.`,
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
