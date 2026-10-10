import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { In, Repository, DataSource, EntityManager } from 'typeorm';
import { User } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { BadRequestException, ConflictException, Injectable, NotFoundException, HttpException, HttpStatus } from '@nestjs/common';
import * as argon2 from 'argon2';
import { UpdateInternalUserDto } from './dto/update-internal-user.dto';
import { planScoringSlot, validateUserUpdate } from './user-rules';
import { ReviewerAssignment } from '@/modules/applications/entities/reviewer-assignment.entity';
import { ReviewerQueueType } from '@/common/enums/reviewer.enum';
import { MfaSecret } from '../auth/entities/mfa-secret.entity';
import { AuditLogService } from '@/modules/audit-log/audit-log.service';
import { ProvisionInternalUserDto } from './dto/provision-internal-user.dto';
import { Role } from '@/common/enums/role.enum';
import { randomUUID, randomInt } from 'crypto';
import { NotificationsService } from '../notifications/notifications.service';
import { EmailVerificationToken } from '../auth/entities/email-verification-token.entity';
import { ResetInternalUserPasswordDto } from './dto/reset-internal-user-password.dto';
import { Application } from '@/modules/applications/entities/application.entity';
import { ApplicationStatus } from '@/common/enums/application.enum';
import { ScoreCard } from '@/modules/scoring/entities/score-card.entity';
import { RefreshToken } from '../auth/entities/refresh-token.entity';
import { ReplaceScoringReviewerDto, TransferScoringWorkDto } from './dto/replace-scoring-reviewer.dto';

export interface ScoringTransferResult {
  outgoingReviewerId: string;
  incomingReviewerId: string;
  transferred: { applicationId: string; organisationName: string }[];
  skipped: { applicationId: string; organisationName: string; reason: string }[];
  keptWithOutgoing: number;
}

const VALIDATION_QUEUE_STATUSES = [
  ApplicationStatus.SHORTLISTED,
  ApplicationStatus.PENDING_ECOSYSTEM_VALIDATION,
  ApplicationStatus.PENDING_VALIDATION,
];

/**
 * Generates a one-time temporary password server-side: 14 characters, guaranteed to
 * include an uppercase letter, a lowercase letter, a digit and a symbol. Used for the
 * "Reset password" recovery path, where there is no earlier client-generated password
 * to fall back on (the original plaintext is never recoverable — only the hash is
 * stored), so the server must be the one to generate it.
 */
function generateTemporaryPassword(): string {
  const groups = ['ABCDEFGHJKLMNPQRSTUVWXYZ', 'abcdefghijkmnopqrstuvwxyz', '23456789', '!@#$%*?'];
  const all = groups.join('');
  const pick = (pool: string) => pool[randomInt(pool.length)];
  const chars = [
    ...groups.map((g) => pick(g)),
    ...Array.from({ length: 14 - groups.length }, () => pick(all)),
  ];
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

export interface DeactivationImpact {
  pendingScoringAssignments: number;
  pendingScoringApplications: { applicationId: string; organisationName: string; queueSlot: number | null }[];
  isSoleActiveValidatorForState: boolean;
  pendingValidationsInState: number;
  isLastActiveAdmin: boolean;
  blocked: boolean;
  blockers: string[];
}

// The four roles UsersController's GET / and PATCH /:id/status are meant to manage —
// ROLE_ESO applicants always go through self-registration (POST /auth/register), never
// through here, so this list doubles as a guard against a crafted ?role=ROLE_ESO query.
const INTERNAL_ROLES = [
  Role.ELIGIBILITY_REVIEWER,
  Role.SCORING_REVIEWER,
  Role.VALIDATOR,
  Role.SYSADMIN,
];

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(EmailVerificationToken)
    private readonly verificationRepo: Repository<EmailVerificationToken>,
    private readonly notificationsService: NotificationsService,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly auditLogService: AuditLogService,
  ) {}

  findByEmail(email: string) {
    return this.userRepo.findOne({ where: { email } });
  }

  findById(id: string) {
    return this.userRepo.findOne({ where: { id } });
  }

  create(dto: CreateUserDto) {
    return this.userRepo.save(this.userRepo.create(dto));
  }

  markEmailVerified(id: string) {
    return this.userRepo.update(id, { isEmailVerified: true });
  }

  deactivate(id: string) {
    return this.userRepo.update(id, { isActive: false });
  }
  updatePassword(id: string, passwordHash: string) {
    return this.userRepo.update(id, { passwordHash });
  }
  async sendVerificationEmail(userId: string, email: string) {
    const token = randomUUID();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await this.verificationRepo.save(
      this.verificationRepo.create({ userId, token, expiresAt }),
    );
    await this.notificationsService.sendEmailVerification(email, token);
  }

  async provisionInternalUser(dto: ProvisionInternalUserDto) {
    const existing = await this.findByEmail(dto.email);
    if (existing) {
      throw new ConflictException('An account with this email already exists');
    }

    if (dto.role === Role.ESO) {
      throw new BadRequestException(
        'Use self-registration for ESO applicant accounts',
      );
    }

    if (dto.role === Role.VALIDATOR && !dto.assignedState) {
      throw new BadRequestException(
        'assignedState is required when provisioning a validator',
      );
    }

    let scoringSlot: number | null = null;
    if (dto.role === Role.SCORING_REVIEWER) {
      const plan = planScoringSlot(await this.activeScoringReviewers(), dto.scoringSlot);
      if ('error' in plan) throw new ConflictException(plan.error);
      scoringSlot = plan.slot;
    }

    const passwordHash = await argon2.hash(dto.password);

    const user = await this.create({
      email: dto.email,
      passwordHash,
      fullName: dto.fullName,
      role: dto.role,
      assignedState: dto.role === Role.VALIDATOR ? dto.assignedState?.trim().toUpperCase() : undefined,
      scoringSlot,
    });
    await this.sendVerificationEmail(user.id, user.email);

    await this.auditLogService.record({
      actorId: user.id,
      actorRole: 'ROLE_SYSADMIN',
      action: 'USER_PROVISIONED',
      entityType: 'User',
      entityId: user.id,
      metadata: { email: user.email, role: user.role },
    });
    // The generated password is shown once to the provisioning administrator via the
    // persistent credentials panel on the frontend — recorded here as a reveal event,
    // distinct from (and always alongside) provisioning itself.
    await this.auditLogService.record({
      actorId: user.id,
      actorRole: 'ROLE_SYSADMIN',
      action: 'USER_CREDENTIALS_REVEALED',
      entityType: 'User',
      entityId: user.id,
      metadata: { email: user.email, context: 'provisioning' },
    });

    if (dto.sendCredentialsEmail) {
      await this.notificationsService.sendCredentialsEmail(user.email, dto.password, user.fullName);
      await this.auditLogService.record({
        actorId: user.id,
        actorRole: 'ROLE_SYSADMIN',
        action: 'USER_CREDENTIALS_EMAILED',
        entityType: 'User',
        entityId: user.id,
        metadata: { email: user.email, context: 'provisioning' },
      });
    }

    return user;

    // isEmailVerified stays false — they still verify their own email before first login,
    // isActive defaults true so they show up once verified
  }

  /**
   * Recovery path for lost credentials: there is no way to recover the original
   * plaintext password (only its hash is stored), so this generates a brand new
   * temporary one server-side, hashes and stores it, and returns the plaintext once
   * so the admin can hand it off through the same persistent credentials panel used
   * at provisioning time.
   */
  async resetPassword(
    id: string,
    actorId: string,
    dto: ResetInternalUserPasswordDto,
  ): Promise<{ email: string; temporaryPassword: string }> {
    const user = await this.findById(id);
    if (!user) throw new NotFoundException('User not found');
    if (!INTERNAL_ROLES.includes(user.role)) {
      throw new BadRequestException('Applicant accounts use self-service password reset instead');
    }

    const temporaryPassword = generateTemporaryPassword();
    const passwordHash = await argon2.hash(temporaryPassword);
    await this.userRepo.update(id, { passwordHash });

    await this.auditLogService.record({
      actorId,
      actorRole: 'ROLE_SYSADMIN',
      action: 'USER_PASSWORD_RESET',
      entityType: 'User',
      entityId: id,
      metadata: { email: user.email },
    });
    await this.auditLogService.record({
      actorId,
      actorRole: 'ROLE_SYSADMIN',
      action: 'USER_CREDENTIALS_REVEALED',
      entityType: 'User',
      entityId: id,
      metadata: { email: user.email, context: 'password-reset' },
    });

    if (dto.sendCredentialsEmail) {
      await this.notificationsService.sendCredentialsEmail(user.email, temporaryPassword, user.fullName);
      await this.auditLogService.record({
        actorId,
        actorRole: 'ROLE_SYSADMIN',
        action: 'USER_CREDENTIALS_EMAILED',
        entityType: 'User',
        entityId: id,
        metadata: { email: user.email, context: 'password-reset' },
      });
    }

    return { email: user.email, temporaryPassword };
  }

  /**
   * What is tied to this account, for the "Deactivate" confirmation flow. A scoring
   * reviewer with uncompleted assignments, or the only active validator covering a
   * state that still has applications waiting in its validation queue, cannot be
   * silently deactivated — the admin needs to reassign that work first.
   */
  private async moveOpenScoringWork(
    manager: EntityManager,
    outgoing: User,
    incoming: User,
  ): Promise<ScoringTransferResult> {
    const assignmentRepo = manager.getRepository(ReviewerAssignment);
    const open = await assignmentRepo.find({
      where: { reviewerId: outgoing.id, queueType: ReviewerQueueType.SCORING, completed: false },
      relations: { application: true },
    });
    const keptWithOutgoing = await assignmentRepo.count({
      where: { reviewerId: outgoing.id, queueType: ReviewerQueueType.SCORING, completed: true },
    });

    const transferred: ScoringTransferResult['transferred'] = [];
    const skipped: ScoringTransferResult['skipped'] = [];
    for (const assignment of open) {
      const organisationName =
        assignment.application?.organisationLegalName ??
        assignment.application?.applicationRef ??
        assignment.applicationId;
      const clash = await assignmentRepo.findOne({
        where: {
          applicationId: assignment.applicationId,
          reviewerId: incoming.id,
          queueType: ReviewerQueueType.SCORING,
        },
      });
      if (clash) {
        skipped.push({
          applicationId: assignment.applicationId,
          organisationName,
          reason: `${incoming.fullName ?? incoming.email} is already the other scorer on this application`,
        });
        continue;
      }
      await manager.getRepository(ScoreCard).delete({
        applicationId: assignment.applicationId,
        reviewerId: outgoing.id,
        submitted: false,
      } as any);
      assignment.reviewerId = incoming.id;
      assignment.assignedAt = new Date();
      await assignmentRepo.save(assignment);
      transferred.push({ applicationId: assignment.applicationId, organisationName });
    }
    return {
      outgoingReviewerId: outgoing.id,
      incomingReviewerId: incoming.id,
      transferred,
      skipped,
      keptWithOutgoing,
    };
  }

  private async recordScoringTransfer(
    result: ScoringTransferResult,
    actorId: string,
    via: 'transfer' | 'replacement',
    reason?: string,
  ) {
    for (const item of result.transferred) {
      await this.auditLogService.record({
        actorId,
        actorRole: 'ROLE_SYSADMIN',
        action: 'SCORING_REVIEWER_REASSIGNED',
        entityType: 'Application',
        entityId: item.applicationId,
        metadata: {
          outgoingReviewerId: result.outgoingReviewerId,
          incomingReviewerId: result.incomingReviewerId,
          via,
        },
      });
    }
    await this.auditLogService.record({
      actorId,
      actorRole: 'ROLE_SYSADMIN',
      action: via === 'replacement' ? 'SCORING_REVIEWER_REPLACED' : 'SCORING_WORK_TRANSFERRED',
      entityType: 'User',
      entityId: result.outgoingReviewerId,
      metadata: {
        incomingReviewerId: result.incomingReviewerId,
        transferred: result.transferred.length,
        skipped: result.skipped.map((s) => ({ applicationId: s.applicationId, reason: s.reason })),
        keptWithOutgoing: result.keptWithOutgoing,
        ...(reason ? { reason } : {}),
      },
    });
    if (result.transferred.length > 0) {
      const count = result.transferred.length;
      await this.notificationsService.notifyUser(
        result.incomingReviewerId,
        'Scoring work handed over to you',
        `${count} application${count === 1 ? ' has' : 's have'} been moved to your scoring queue.`,
        '/internal/applications?queue=scoring',
      );
    }
  }

  async transferScoringWork(
    outgoingId: string,
    dto: TransferScoringWorkDto,
    actorId: string,
  ): Promise<ScoringTransferResult> {
    if (outgoingId === dto.incomingReviewerId) {
      throw new BadRequestException('Choose a different reviewer to take over the work');
    }
    const outgoing = await this.findById(outgoingId);
    if (!outgoing) throw new NotFoundException('User not found');
    if (outgoing.role !== Role.SCORING_REVIEWER) {
      throw new BadRequestException('Only Scoring Reviewer work can be transferred here');
    }
    const incoming = await this.findById(dto.incomingReviewerId);
    if (!incoming || incoming.role !== Role.SCORING_REVIEWER || !incoming.isActive) {
      throw new BadRequestException('The reviewer taking over must be an active Scoring Reviewer account');
    }
    if (incoming.scoringSlot === null || incoming.scoringSlot === undefined) {
      throw new BadRequestException(
        `${incoming.email} has no reviewer slot. Set them as Reviewer 1 or Reviewer 2 in Users & Roles first.`,
      );
    }
    if (
      outgoing.scoringSlot !== null &&
      outgoing.scoringSlot !== undefined &&
      outgoing.scoringSlot !== incoming.scoringSlot
    ) {
      throw new BadRequestException(
        `The reviewer taking over must hold the same slot as the outgoing reviewer (Reviewer ${outgoing.scoringSlot}). ` +
          'The other slot holder is already the second scorer on these applications. Create a replacement through "Hand over work" instead.',
      );
    }

    const result = await this.dataSource.transaction((manager) =>
      this.moveOpenScoringWork(manager, outgoing, incoming),
    );
    await this.recordScoringTransfer(result, actorId, 'transfer', dto.reason);
    return result;
  }

  async replaceScoringReviewer(
    outgoingId: string,
    dto: ReplaceScoringReviewerDto,
    actorId: string,
  ): Promise<
    ScoringTransferResult & {
      replacement: { id: string; email: string; fullName: string; scoringSlot: number | null; created: boolean };
      temporaryPassword: string | null;
    }
  > {
    if (Boolean(dto.newReviewer) === Boolean(dto.replacementUserId)) {
      throw new BadRequestException('Provide either a new reviewer to create or an existing suspended reviewer, not both');
    }
    if (actorId === outgoingId) {
      throw new BadRequestException("You can't replace your own account");
    }
    const outgoing = await this.findById(outgoingId);
    if (!outgoing) throw new NotFoundException('User not found');
    if (outgoing.role !== Role.SCORING_REVIEWER) {
      throw new BadRequestException('Only a Scoring Reviewer can be replaced here');
    }

    let existing: User | null = null;
    if (dto.replacementUserId) {
      if (dto.replacementUserId === outgoingId) {
        throw new BadRequestException('Choose a different account as the replacement');
      }
      existing = await this.findById(dto.replacementUserId);
      if (!existing || existing.role !== Role.SCORING_REVIEWER) {
        throw new BadRequestException('The replacement must be a Scoring Reviewer account');
      }
      if (existing.isActive) {
        throw new BadRequestException(
          'That reviewer is already active and holds the other slot. Pick a suspended reviewer or create a new account.',
        );
      }
    } else if (dto.newReviewer) {
      const email = dto.newReviewer.email.trim();
      if (await this.findByEmail(email)) {
        throw new ConflictException('An account with this email already exists');
      }
    }

    const temporaryPassword = dto.newReviewer && !dto.newReviewer.password ? generateTemporaryPassword() : null;
    const plainPassword = dto.newReviewer ? (dto.newReviewer.password ?? temporaryPassword) : null;
    const passwordHash = plainPassword ? await argon2.hash(plainPassword) : null;

    const { result, replacement } = await this.dataSource.transaction(async (manager) => {
      const users = manager.getRepository(User);
      const locked = await users.findOne({ where: { id: outgoingId }, lock: { mode: 'pessimistic_write' } });
      if (!locked) throw new NotFoundException('User not found');

      const othersActive = await users.find({ where: { role: Role.SCORING_REVIEWER, isActive: true } });
      const otherHolders = othersActive.filter((u) => u.id !== outgoingId && u.id !== existing?.id);
      const takenByOthers = new Set(otherHolders.map((u) => u.scoringSlot).filter((s): s is number => s !== null));
      const slot =
        locked.scoringSlot && !takenByOthers.has(locked.scoringSlot)
          ? locked.scoringSlot
          : ([1, 2].find((s) => !takenByOthers.has(s)) ?? null);
      if (slot === null || otherHolders.length >= 2) {
        throw new ConflictException('No reviewer slot is free for the replacement, even after the outgoing reviewer is suspended.');
      }

      await users.update(outgoingId, { isActive: false });
      await manager.getRepository(RefreshToken).update({ userId: outgoingId, revoked: false }, { revoked: true });

      let incoming: User;
      if (existing) {
        await users.update(existing.id, { isActive: true, scoringSlot: slot });
        incoming = (await users.findOne({ where: { id: existing.id } })) as User;
      } else {
        incoming = await users.save(
          users.create({
            email: dto.newReviewer!.email.trim(),
            fullName: dto.newReviewer!.fullName.trim(),
            passwordHash: passwordHash as string,
            role: Role.SCORING_REVIEWER,
            scoringSlot: slot,
          }),
        );
      }

      const moved = await this.moveOpenScoringWork(manager, locked, incoming);
      return { result: moved, replacement: incoming };
    });

    await this.auditLogService.record({
      actorId,
      actorRole: 'ROLE_SYSADMIN',
      action: 'USER_SUSPENDED',
      entityType: 'User',
      entityId: outgoingId,
      metadata: { email: outgoing.email, reason: dto.reason ?? 'Replaced by another Scoring Reviewer', replacedBy: replacement.id },
    });
    if (existing) {
      await this.auditLogService.record({
        actorId,
        actorRole: 'ROLE_SYSADMIN',
        action: 'USER_REACTIVATED',
        entityType: 'User',
        entityId: replacement.id,
        metadata: { email: replacement.email, replacing: outgoingId, scoringSlot: replacement.scoringSlot },
      });
      if (!replacement.isEmailVerified) {
        await this.verificationRepo.delete({ userId: replacement.id });
        await this.sendVerificationEmail(replacement.id, replacement.email);
      }
    } else {
      await this.sendVerificationEmail(replacement.id, replacement.email);
      await this.auditLogService.record({
        actorId,
        actorRole: 'ROLE_SYSADMIN',
        action: 'USER_PROVISIONED',
        entityType: 'User',
        entityId: replacement.id,
        metadata: { email: replacement.email, role: replacement.role, replacing: outgoingId, scoringSlot: replacement.scoringSlot },
      });
      if (temporaryPassword) {
        await this.auditLogService.record({
          actorId,
          actorRole: 'ROLE_SYSADMIN',
          action: 'USER_CREDENTIALS_REVEALED',
          entityType: 'User',
          entityId: replacement.id,
          metadata: { email: replacement.email, context: 'replacement' },
        });
      }
      if (dto.sendCredentialsEmail && plainPassword) {
        await this.notificationsService.sendCredentialsEmail(replacement.email, plainPassword, replacement.fullName);
        await this.auditLogService.record({
          actorId,
          actorRole: 'ROLE_SYSADMIN',
          action: 'USER_CREDENTIALS_EMAILED',
          entityType: 'User',
          entityId: replacement.id,
          metadata: { email: replacement.email, context: 'replacement' },
        });
      }
    }
    await this.recordScoringTransfer(result, actorId, 'replacement', dto.reason);

    return {
      ...result,
      replacement: {
        id: replacement.id,
        email: replacement.email,
        fullName: replacement.fullName,
        scoringSlot: replacement.scoringSlot ?? null,
        created: !existing,
      },
      temporaryPassword,
    };
  }

  async getDeactivationImpact(id: string): Promise<DeactivationImpact> {
    const user = await this.findById(id);
    if (!user) throw new NotFoundException('User not found');

    let pendingScoringApplications: DeactivationImpact['pendingScoringApplications'] = [];
    if (user.role === Role.SCORING_REVIEWER) {
      const assignments = await this.dataSource.getRepository(ReviewerAssignment).find({
        where: { reviewerId: id, queueType: ReviewerQueueType.SCORING, completed: false },
        relations: { application: true },
      });
      pendingScoringApplications = assignments.map((a) => ({
        applicationId: a.applicationId,
        organisationName: a.application?.organisationLegalName ?? a.applicationId,
        queueSlot: user.scoringSlot ?? null,
      }));
    }

    let isSoleActiveValidatorForState = false;
    let pendingValidationsInState = 0;
    if (user.role === Role.VALIDATOR && user.assignedState) {
      const otherValidators = await this.userRepo.count({
        where: { role: Role.VALIDATOR, isActive: true, assignedState: user.assignedState },
      });
      isSoleActiveValidatorForState = user.isActive && otherValidators <= 1;
      if (isSoleActiveValidatorForState) {
        pendingValidationsInState = await this.dataSource
          .getRepository(Application)
          .createQueryBuilder('application')
          .innerJoin('application.preferredInstitution', 'institution')
          .where('UPPER(institution.state) = UPPER(:state)', { state: user.assignedState.trim() })
          .andWhere('application.status IN (:...statuses)', { statuses: VALIDATION_QUEUE_STATUSES })
          .getCount();
      }
    }

    const isLastActiveAdmin =
      user.role === Role.SYSADMIN && user.isActive && (await this.countActiveAdmins()) <= 1;

    const blockers: string[] = [];
    if (pendingScoringApplications.length > 0) {
      blockers.push(
        `${pendingScoringApplications.length} unscored application(s) are still assigned to this reviewer. Use "Hand over work" to move all of them to a replacement reviewer in one step.`,
      );
    }
    if (isSoleActiveValidatorForState && pendingValidationsInState > 0) {
      blockers.push(
        `This is the only active validator for ${user.assignedState} and ${pendingValidationsInState} application(s) are waiting in that state's validation queue — assign another validator to ${user.assignedState} first, or nominate a replacement below.`,
      );
    }
    if (isLastActiveAdmin) {
      blockers.push('This is the last active administrator — assign another administrator first.');
    }

    return {
      pendingScoringAssignments: pendingScoringApplications.length,
      pendingScoringApplications,
      isSoleActiveValidatorForState,
      pendingValidationsInState,
      isLastActiveAdmin,
      blocked: blockers.length > 0,
      blockers,
    };
  }

  setMfaEnabled(id: string, enabled: boolean) {
    return this.userRepo.update(id, { mfaEnabled: enabled });
  }

  /**
   * Backs GET /internal/users. Was missing entirely — UsersController already called
   * this. Never returns ROLE_ESO applicants, matching the controller's documented
   * contract (see INTERNAL_ROLES above); a crafted ?role=ROLE_ESO is rejected rather
   * than silently ignored.
   */
  async listInternalUsers(role?: Role): Promise<User[]> {
    if (role && !INTERNAL_ROLES.includes(role)) {
      throw new BadRequestException(
        `role must be one of ${INTERNAL_ROLES.join(', ')}`,
      );
    }
    return this.userRepo.find({
      where: { role: In(role ? [role] : INTERNAL_ROLES) },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Backs PATCH /internal/users/:id/status. Was missing entirely — UsersController
   * already called this. Supersedes the one-directional `deactivate()` above (kept
   * as-is since it may still be referenced elsewhere) by allowing both suspend
   * (isActive: false) and reactivate (isActive: true) through the same call.
   */
  private activeScoringReviewers() {
    return this.userRepo.find({ where: { role: Role.SCORING_REVIEWER, isActive: true } });
  }

  private countActiveAdmins() {
    return this.userRepo.count({ where: { role: Role.SYSADMIN, isActive: true } });
  }

  async setActive(
    id: string,
    isActive: boolean,
    actorId?: string,
    reason?: string,
    acknowledgeOpenWork?: boolean,
  ): Promise<User> {
    const user = await this.findById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    if (!isActive) {
      if (actorId && actorId === id) {
        throw new BadRequestException("You can't suspend your own account");
      }
      if (user.role === Role.SYSADMIN && user.isActive && (await this.countActiveAdmins()) <= 1) {
        throw new ConflictException('This is the last active administrator — assign another administrator first');
      }

      const impact = await this.getDeactivationImpact(id);
      if (impact.blocked) {
        // The last-active-administrator case is a hard stop — there is no acknowledgment
        // that makes deactivating the only admin account safe.
        if (impact.isLastActiveAdmin) {
          throw new ConflictException('This is the last active administrator — assign another administrator first');
        }
        // Everything else (unscored assignments, sole validator coverage of a state)
        // is a soft stop: the first attempt is refused with the breakdown below so this
        // can never happen silently, but a second, explicit acknowledgment is allowed
        // to proceed — the platform has no way to force a same-slot replacement to
        // exist right now (Scoring Reviewer accounts are capped at two active at a
        // time, so a slot only frees up once its holder is deactivated), so open
        // scoring assignments necessarily outlive the reviewer being deactivated and
        // must be reassigned per-application afterwards, once a replacement is in place.
        if (!acknowledgeOpenWork) {
          throw new ConflictException({
            message: "This account has open work tied to it. Review what's open before deactivating.",
            blockers: impact.blockers,
            impact,
          });
        }
      }
    }
    if (isActive && !user.isActive && user.role === Role.SCORING_REVIEWER) {
      const plan = planScoringSlot(await this.activeScoringReviewers(), user.scoringSlot ?? undefined, user.id);
      if ('error' in plan) throw new ConflictException(plan.error);
      user.scoringSlot = plan.slot;
      await this.userRepo.update(id, { scoringSlot: plan.slot });
    }
    await this.userRepo.update(id, { isActive });
    // Return the entity instance (not a spread copy) so ClassSerializerInterceptor still
    // strips the @Exclude()d passwordHash from the response.
    user.isActive = isActive;
    await this.auditLogService.record({
      actorId: actorId ?? id,
      actorRole: 'ROLE_SYSADMIN',
      action: isActive ? 'USER_REACTIVATED' : 'USER_SUSPENDED',
      entityType: 'User',
      entityId: id,
      metadata: {
        email: user.email,
        ...(reason ? { reason } : {}),
        ...(!isActive && acknowledgeOpenWork ? { deactivatedWithOpenWork: true } : {}),
      },
    });
    return user;
  }

  /** Edit name, role, validator state or reviewer slot of an internal account. */
  async updateInternalUser(id: string, dto: UpdateInternalUserDto, actorId: string): Promise<User> {
    const user = await this.findById(id);
    if (!user) throw new NotFoundException('User not found');

    const pending =
      user.role === Role.SCORING_REVIEWER
        ? await this.dataSource.getRepository(ReviewerAssignment).count({
            where: { reviewerId: id, queueType: ReviewerQueueType.SCORING, completed: false },
          })
        : 0;

    const problem = validateUserUpdate({
      actorId,
      target: { id, role: user.role, isActive: user.isActive, assignedState: user.assignedState ?? null },
      newRole: dto.role,
      newAssignedState: dto.assignedState !== undefined ? dto.assignedState.trim().toUpperCase() || null : undefined,
      activeAdminCount: await this.countActiveAdmins(),
      pendingScoringAssignments: pending,
    });
    if (problem) throw new BadRequestException(problem);

    const finalRole = (dto.role as Role | undefined) ?? user.role;
    const changes: Partial<User> = {};
    if (dto.fullName !== undefined) changes.fullName = dto.fullName.trim();
    if (finalRole !== user.role) changes.role = finalRole;

    changes.assignedState =
      finalRole === Role.VALIDATOR
        ? dto.assignedState?.trim().toUpperCase() || user.assignedState
        : (null as unknown as string);

    if (finalRole === Role.SCORING_REVIEWER) {
      const roleChanged = finalRole !== user.role;
      const requested = dto.scoringSlot ?? (roleChanged ? undefined : (user.scoringSlot ?? undefined));
      if (user.isActive || roleChanged) {
        const plan = planScoringSlot(await this.activeScoringReviewers(), requested, user.id);
        if ('error' in plan) throw new ConflictException(plan.error);
        changes.scoringSlot = plan.slot;
      } else if (dto.scoringSlot !== undefined) {
        changes.scoringSlot = dto.scoringSlot;
      }
    } else {
      changes.scoringSlot = null;
    }

    await this.userRepo.update(id, changes);
    const updated = (await this.findById(id)) as User;
    await this.auditLogService.record({
      actorId,
      actorRole: 'ROLE_SYSADMIN',
      action: 'USER_UPDATED',
      entityType: 'User',
      entityId: id,
      metadata: {
        before: { fullName: user.fullName, role: user.role, assignedState: user.assignedState, scoringSlot: user.scoringSlot },
        after: { fullName: updated.fullName, role: updated.role, assignedState: updated.assignedState, scoringSlot: updated.scoringSlot },
      },
    });
    return updated;
  }

  /**
   * Unlocks someone who can no longer pass two-factor sign-in (lost phone, lost backup codes, stale
   * authenticator entry): removes their authenticator secret and backup codes, so the next sign-in
   * walks them through enrolment again. Internal accounts only.
   */
  async resetMfa(id: string, actorId: string): Promise<{ reset: true }> {
    const user = await this.findById(id);
    if (!user) throw new NotFoundException('User not found');
    if (!INTERNAL_ROLES.includes(user.role)) {
      throw new BadRequestException('Applicant accounts do not use two-factor sign-in');
    }
    await this.dataSource.getRepository(MfaSecret).delete({ userId: id } as any);
    await this.userRepo.update(id, { mfaEnabled: false });
    await this.auditLogService.record({
      actorId,
      actorRole: 'ROLE_SYSADMIN',
      action: 'USER_MFA_RESET',
      entityType: 'User',
      entityId: id,
      metadata: { email: user.email },
    });
    return { reset: true };
  }

  /** Re-sends the activation email to an invited (not yet verified) internal user. */
  async resendInvite(id: string, actorId: string): Promise<{ sent: true; email: string }> {
    const user = await this.findById(id);
    if (!user) throw new NotFoundException('User not found');
    if (!INTERNAL_ROLES.includes(user.role)) {
      throw new BadRequestException('Applicant accounts verify through self-registration');
    }
    if (!user.isActive) throw new BadRequestException('This account is suspended — reactivate it first');
    if (user.isEmailVerified) throw new BadRequestException('This account has already been activated');

    const latest = await this.verificationRepo.findOne({ where: { userId: id }, order: { createdAt: 'DESC' } });
    if (latest && Date.now() - new Date(latest.createdAt).getTime() < 60_000) {
      throw new HttpException('An invitation was just sent. Please wait a minute before resending.', HttpStatus.TOO_MANY_REQUESTS);
    }
    await this.verificationRepo.delete({ userId: id });
    await this.sendVerificationEmail(user.id, user.email);
    await this.auditLogService.record({
      actorId,
      actorRole: 'ROLE_SYSADMIN',
      action: 'USER_INVITE_RESENT',
      entityType: 'User',
      entityId: id,
      metadata: { email: user.email },
    });
    return { sent: true, email: user.email };
  }
}