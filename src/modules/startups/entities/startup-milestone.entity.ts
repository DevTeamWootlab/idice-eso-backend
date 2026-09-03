import { Entity, Column, ManyToOne } from 'typeorm';
import { BaseEntity } from '@/common/entities/base.entity';
import { Beneficiary } from '@modules/beneficiaries/entities/beneficiary.entity';

@Entity('startup_milestones')
export class StartupMilestone extends BaseEntity {
  @ManyToOne(() => Beneficiary)
  beneficiary!: Beneficiary;

  @Column()
  beneficiaryId!: string;

  @Column()
  milestoneTitle!: string;

  @Column({ type: 'text', nullable: true })
  description!: string;

  @Column({ type: 'date', nullable: true })
  achievedOn!: Date;

  @Column({ nullable: true })
  evidenceStorageKey!: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  fundingRaisedNgn!: number;

  @Column({ default: false })
  isRegistered!: boolean;
}
