import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '@/common/entities/base.entity';

@Entity('monthly_reports')
@Index('IDX_monthly_reports_application_month', ['applicationId', 'reportMonth'], { unique: true })
export class MonthlyReport extends BaseEntity {
  @Column({ type: 'uuid' })
  applicationId!: string;

  @Column({ type: 'uuid' })
  institutionId!: string;

  @Column({ type: 'varchar', length: 7 })
  reportMonth!: string;

  @Column({ type: 'varchar', nullable: true })
  fileUrl!: string | null;

  @Column({ type: 'varchar', nullable: true })
  fileName!: string | null;

  @Column({ type: 'boolean', default: false })
  isNil!: boolean;

  @Column({ type: 'int', nullable: true })
  beneficiaryCount!: number | null;

  @Column({ type: 'timestamptz' })
  submittedAt!: Date;

  @Column({ type: 'uuid' })
  submittedById!: string;
}
