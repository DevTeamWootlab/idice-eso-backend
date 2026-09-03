import { Entity, Column, OneToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '@/common/entities/base.entity';
import { SubAwardTranche } from './sub-award-tranche.entity';

@Entity('financial_retirements')
export class FinancialRetirement extends BaseEntity {
  @OneToOne(() => SubAwardTranche)
  @JoinColumn()
  tranche!: SubAwardTranche;

  @Column()
  trancheId!: string;

  @Column({ type: 'decimal', precision: 14, scale: 2 })
  amountRetiredNgn!: number;

  @Column({ type: 'jsonb' })
  supportingDocuments!: { documentType: string; storageKey: string }[];

  @Column({ type: 'date', nullable: true })
  submittedAt!: Date;

  @Column({ default: false })
  approved!: boolean;

  @Column({ nullable: true })
  approvedByUserId!: string;

  @Column({ type: 'text', nullable: true })
  reviewNotes!: string;
}
