import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, In } from 'typeorm';
import { BeneficiaryStatus } from '@/common/enums/beneficiary.enum';
import { AuditLogService } from '@/modules/audit-log/audit-log.service';
import { Beneficiary } from '../entities/beneficiary.entity';
import { BeneficiariesService } from '../beneficiaries.service';

const START_DELAY_MS = 8000;
const PAUSE_BETWEEN_MS = 600;
const LOCK_KEY = 'idice-pending-beneficiary-allocation';
export const PENDING_ALLOCATION_DONE = 'BENEFICIARY_PENDING_AUTO_ALLOCATION_DONE';
export const PENDING_STATUSES = [
  BeneficiaryStatus.SUBMITTED,
  BeneficiaryStatus.UNDER_REVIEW,
  BeneficiaryStatus.SHORTLISTED,
];

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

@Injectable()
export class PendingAllocationStartupService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger('PendingYouthAllocation');
  private timer: NodeJS.Timeout | null = null;
  private stopping = false;

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly beneficiaries: BeneficiariesService,
    private readonly audit: AuditLogService,
  ) {}

  onApplicationBootstrap() {
    if (
      process.env.AUTO_ALLOCATE_PENDING_YOUTH === 'false' ||
      process.env.SELECTED_ESOS_CLI === '1' ||
      process.env.NODE_ENV === 'test'
    ) {
      return;
    }
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.run();
    }, START_DELAY_MS);
    this.timer.unref?.();
  }

  onApplicationShutdown() {
    this.stopping = true;
    if (this.timer) clearTimeout(this.timer);
  }

  async run(pauseMs = PAUSE_BETWEEN_MS): Promise<{ allocated: number; left: number } | null> {
    const lock = this.dataSource.createQueryRunner();
    await lock.connect();
    try {
      const [{ locked }] = (await lock.query('SELECT pg_try_advisory_lock(hashtext($1)) AS locked', [LOCK_KEY])) as {
        locked: boolean;
      }[];
      if (!locked) {
        this.logger.log('Another server is allocating waiting youth right now. Skipped here.');
        return null;
      }
      try {
        return await this.allocatePending(pauseMs);
      } finally {
        await lock.query('SELECT pg_advisory_unlock(hashtext($1))', [LOCK_KEY]);
      }
    } catch (error) {
      this.logger.error(
        `Waiting youth were not all allocated: ${error instanceof Error ? error.message : String(error)}. It retries on the next start-up.`,
      );
      return null;
    } finally {
      await lock.release();
    }
  }

  private async allocatePending(pauseMs: number) {
    const done = await this.dataSource.query(`SELECT 1 FROM audit_logs WHERE action = $1 LIMIT 1`, [
      PENDING_ALLOCATION_DONE,
    ]);
    if (done.length > 0) return null;

    const waiting = await this.dataSource.getRepository(Beneficiary).find({
      select: { id: true, referenceId: true, preferredInstitutionId: true },
      where: { status: In(PENDING_STATUSES) },
      order: { createdAt: 'ASC' },
    });
    this.logger.log(`Allocating ${waiting.length} waiting youth to the Centre of Excellence each one chose (once).`);

    let allocated = 0;
    const left: { referenceId: string; reason: string }[] = [];
    for (const person of waiting) {
      if (this.stopping) throw new Error('the server is shutting down');
      if (!person.preferredInstitutionId) {
        left.push({ referenceId: person.referenceId, reason: 'No Centre of Excellence was chosen' });
        continue;
      }
      try {
        await this.beneficiaries.updateStatusForAdmin(person.id, {
          status: BeneficiaryStatus.ALLOCATED,
          institutionId: person.preferredInstitutionId,
        });
        await this.beneficiaries.recordAutoAllocation(person.id, person.preferredInstitutionId, 'pending-backlog');
        allocated += 1;
      } catch (error) {
        left.push({
          referenceId: person.referenceId,
          reason: error instanceof Error ? error.message : String(error),
        });
      }
      if (pauseMs > 0) await pause(pauseMs);
    }

    for (const item of left) {
      this.logger.warn(`${item.referenceId} left for an administrator to allocate: ${item.reason}`);
    }
    await this.audit.record({
      actorId: 'SYSTEM',
      actorRole: 'SYSTEM',
      action: PENDING_ALLOCATION_DONE,
      entityType: 'Beneficiary',
      entityId: 'pending-backlog',
      metadata: { waiting: waiting.length, allocated, left },
    });
    this.logger.log(`Allocated ${allocated} of ${waiting.length} waiting youth. ${left.length} left for an administrator.`);
    return { allocated, left: left.length };
  }
}
