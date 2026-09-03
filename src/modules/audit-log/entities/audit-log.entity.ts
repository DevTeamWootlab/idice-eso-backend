import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '@common/entities/base.entity';

@Entity('audit_logs')
@Index(['entityType', 'entityId'])
@Index(['actorId'])
export class AuditLog extends BaseEntity {
  @Column()
  actorId!: string;

  @Column()
  actorRole!: string;

  @Column()
  action!: string; // e.g. 'ELIGIBILITY_APPROVED', 'SCORE_SUBMITTED', 'STATE_TRANSITION'

  @Column()
  entityType!: string; // 'Application' | 'ScoreCard' | 'Beneficiary' etc.

  @Column()
  entityId!: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata!: Record<string, any>; // before/after values, remarks, variance %, etc.

  @Column({ nullable: true })
  ipAddress!: string;
}
