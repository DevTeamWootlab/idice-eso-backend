import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from './entities/audit-log.entity';

@Injectable()
export class AuditLogService {
  constructor(
    @InjectRepository(AuditLog)
    private readonly auditLogRepo: Repository<AuditLog>,
  ) {}

  async record(entry: Partial<AuditLog>): Promise<AuditLog> {
    return this.auditLogRepo.save(entry);
  }

  /**
   * Newest-first audit trail for one entity (e.g. an Application) — backs the
   * "Audit trail" panel reviewers see on the application detail page. Access control
   * (who is allowed to see this application's trail at all) is the caller's job.
   */
  async findForEntity(
    entityType: string,
    entityId: string,
  ): Promise<AuditLog[]> {
    return this.auditLogRepo.find({
      where: { entityType, entityId },
      order: { createdAt: 'DESC' },
    });
  }
}
