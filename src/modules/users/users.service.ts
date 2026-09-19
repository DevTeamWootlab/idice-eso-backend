import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { In, Repository, DataSource } from 'typeorm';
import { User } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { BadRequestException, ConflictException, Injectable, NotFoundException, HttpException, HttpStatus } from '@nestjs/common';
import * as argon2 from 'argon2';
import { UpdateInternalUserDto } from './dto/update-internal-user.dto';
import { planScoringSlot, validateUserUpdate } from './user-rules';
import { ReviewerAssignment } from '@/modules/applications/entities/reviewer-assignment.entity';
import { ReviewerQueueType } from '@/common/enums/reviewer.enum';
import { AuditLogService } from '@/modules/audit-log/audit-log.service';
import { ProvisionInternalUserDto } from './dto/provision-internal-user.dto';
import { Role } from '@/common/enums/role.enum';
import { randomUUID } from 'crypto';
import { NotificationsService } from '../notifications/notifications.service';
import { EmailVerificationToken } from '../auth/entities/email-verification-token.entity';

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

    return user;

    // isEmailVerified stays false — they still verify their own email before first login,
    // isActive defaults true so they show up once verified
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

  async setActive(id: string, isActive: boolean, actorId?: string): Promise<User> {
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
      metadata: { email: user.email },
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
