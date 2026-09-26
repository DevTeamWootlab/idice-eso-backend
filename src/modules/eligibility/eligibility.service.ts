import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EligibilityChecklist } from './entities/eligibility-checklist.entity';
import {
  EligibilityCheckItem,
  EligibilityCheckCode,
} from './entities/eligibility-check-item.entity';
import { Application } from '../applications/entities/application.entity';
import { ApplicationsStateMachineService } from '../applications/applications-state-machine.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { ApplicationStatus } from '../../common/enums/application.enum';
import { SubmitEligibilityReviewDto } from './dto/submit-eligibility-review.dto';

const ALL_CHECK_CODES = Object.values(EligibilityCheckCode);

@Injectable()
export class EligibilityService {
  constructor(
    @InjectRepository(EligibilityChecklist)
    private readonly checklistRepo: Repository<EligibilityChecklist>,
    @InjectRepository(EligibilityCheckItem)
    private readonly checkItemRepo: Repository<EligibilityCheckItem>,
    @InjectRepository(Application)
    private readonly applicationRepo: Repository<Application>,
    private readonly stateMachine: ApplicationsStateMachineService,
    private readonly notificationsService: NotificationsService,
    private readonly auditLogService: AuditLogService,
  ) {}

  /**
   * TC-ELI-01 — only SUBMITTED / IN_REVIEW_ELIGIBILITY show up,
   * and narrative/qualitative fields are stripped out entirely
   * (cognitive bias masking) rather than just hidden client-side.
   */
  async getQueue() {
    const applications = await this.applicationRepo.find({
      where: [
        { status: ApplicationStatus.SUBMITTED },
        { status: ApplicationStatus.IN_REVIEW_ELIGIBILITY },
      ],
      order: { submittedAt: 'ASC' },
    });

    return applications.map((app) => this.maskNarrativeFields(app));
  }

  async getDossier(applicationId: string) {
    const application = await this.applicationRepo.findOne({
      where: { id: applicationId },
      relations: { references: true, documents: true },
    });
    if (!application) throw new NotFoundException('Application not found');
    return this.maskNarrativeFields(application);
  }

  private maskNarrativeFields(application: Application) {
    const {
      programmeDeliveryTrackRecord,
      mentorshipIndustryNetwork,
      inclusionAccessibilityCapacity,
      existingInstitutionalRelationships,
      institutionalCoordinationPlan,
      staffFacultyEngagementPlan,
      beneficiaryReferralPlan,
      monitoringReportingSystems,
      sustainabilityPlan,
      employmentPathway,
      ...rest
    } = application;

    return rest; // narrative fields never leave the service for an eligibility reviewer
  }

  private async getOrCreateChecklist(
    applicationId: string,
    reviewerId: string,
  ) {
    let checklist = await this.checklistRepo.findOne({
      where: { applicationId },
      relations: { items: true },
    });

    if (!checklist) {
      checklist = this.checklistRepo.create({
        applicationId,
        reviewerId,
        items: [],
      });
      checklist = await this.checklistRepo.save(checklist);
    }

    return checklist;
  }

  async submitReview(
    applicationId: string,
    reviewerId: string,
    dto: SubmitEligibilityReviewDto,
  ) {
    const application = await this.applicationRepo.findOne({
      where: { id: applicationId },
    });
    if (!application) throw new NotFoundException('Application not found');

    if (
      ![
        ApplicationStatus.SUBMITTED,
        ApplicationStatus.IN_REVIEW_ELIGIBILITY,
      ].includes(application.status)
    ) {
      throw new BadRequestException(
        `Application is in ${application.status} status and is not awaiting eligibility review`,
      );
    }

    const submittedCodes = dto.items.map((i) => i.code);
    const missingCodes = ALL_CHECK_CODES.filter(
      (c) => !submittedCodes.includes(c),
    );
    if (missingCodes.length > 0) {
      throw new BadRequestException(
        `All 12 statutory checks must be completed. Missing: ${missingCodes.join(', ')}`,
      );
    }

    const checklist = await this.getOrCreateChecklist(
      applicationId,
      reviewerId,
    );

    
    if (application.status === ApplicationStatus.SUBMITTED) {
      // await this.stateMachine.transition(
      //   applicationId,
      //   ApplicationStatus.IN_REVIEW_ELIGIBILITY,
      //   reviewerId,
      //   'ROLE_ELIGIBILITY_REVIEWER',
      // );

      await this.stateMachine.transition(applicationId, {
        targetStatus: ApplicationStatus.IN_REVIEW_ELIGIBILITY,
        actorId: reviewerId,
        role: 'ROLE_ELIGIBILITY_REVIEWER',
      });
    }

    await this.checkItemRepo.delete({ checklistId: checklist.id });
    const items = dto.items.map((i) =>
      this.checkItemRepo.create({
        checklistId: checklist.id,
        code: i.code,
        passed: i.passed,
        note: i.note,
        checkedAt: new Date(),
      }),
    );
    await this.checkItemRepo.save(items);

    const allPassed = dto.items.every((i) => i.passed);

    if (!allPassed && !dto.rejectionRemarks) {
      throw new BadRequestException(
        'Rejection remarks are mandatory when any statutory check fails',
      );
    }

    checklist.overallResult = allPassed ? 'PASS' : 'FAIL';

    checklist.rejectionRemarks = allPassed ? null : dto.rejectionRemarks;
    checklist.decidedAt = new Date();
    checklist.reviewerId = reviewerId;
    await this.checklistRepo.save(checklist);

    if (allPassed) {
      await this.stateMachine.transition(applicationId, {
        targetStatus: ApplicationStatus.IN_REVIEW_SCORING,
        actorId: reviewerId,
        role: 'ROLE_ELIGIBILITY_REVIEWER',
        metadata: {
          checklistId: checklist.id,
        },
      });
      // TC-ELI-02 — reviewer actions are logged with ISO timestamps in the audit trail.
      await this.auditLogService.record({
        actorId: reviewerId,
        actorRole: 'ROLE_ELIGIBILITY_REVIEWER',
        action: 'ELIGIBILITY_APPROVED',
        entityType: 'Application',
        entityId: applicationId,
        metadata: { checklistId: checklist.id },
      });
    } else {
      await this.stateMachine.transition(applicationId, {
        targetStatus: ApplicationStatus.REJECTED,
        actorId: reviewerId,
        role: 'ROLE_ELIGIBILITY_REVIEWER',
        metadata: {
          checklistId: checklist.id,
          reason: dto.rejectionRemarks,
        },
      });
      const rejectionRemarks =
        dto.rejectionRemarks ??
        'Your application did not satisfy all required eligibility criteria.';

      // TC-ELI-04 — disqualification is logged for Grievance Redress Mechanism (GRM) purposes.
      await this.auditLogService.record({
        actorId: reviewerId,
        actorRole: 'ROLE_ELIGIBILITY_REVIEWER',
        action: 'ELIGIBILITY_REJECTED',
        entityType: 'Application',
        entityId: applicationId,
        metadata: { checklistId: checklist.id, rejectionRemarks },
      });

      await this.notificationsService.sendEligibilityRejection(
        application.primaryContactEmail,
        rejectionRemarks,
        application.applicationRef,
      );
    }

    return this.checklistRepo.findOne({
      where: { id: checklist.id },
      relations: { items: true },
    });
  }

  /**
   * TC-ELI rework loop — sends the application back to the applicant
   * without a full rejection (e.g. blurry documents).
   */
  async requestRework(
    applicationId: string,
    reviewerId: string,
    notes: string,
  ) {
    const application = await this.applicationRepo.findOne({
      where: { id: applicationId },
    });
    if (!application) throw new NotFoundException('Application not found');

    await this.stateMachine.transition(applicationId, {
      targetStatus: ApplicationStatus.REWORK_REQUIRED,
      actorId: reviewerId,
      role: 'ROLE_ELIGIBILITY_REVIEWER',
      metadata: {
        notes,
      },
    });

    await this.auditLogService.record({
      actorId: reviewerId,
      actorRole: 'ROLE_ELIGIBILITY_REVIEWER',
      action: 'ELIGIBILITY_REWORK_REQUESTED',
      entityType: 'Application',
      entityId: applicationId,
      metadata: { notes },
    });

    await this.notificationsService.sendReworkRequested(
      application.primaryContactEmail,
      [notes],
      application.applicationRef,
    );
    return { message: 'Rework requested' };
  }
}
