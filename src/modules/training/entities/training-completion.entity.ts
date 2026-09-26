import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '@/common/entities/base.entity';
import { Cohort } from './cohort.entity';
import { Beneficiary } from '@modules/beneficiaries/entities/beneficiary.entity';
import { decimalTransformer } from '@/common/utils/decimal.transformer';

@Entity('training_completions')
export class TrainingCompletion extends BaseEntity {
  @ManyToOne(() => Cohort)
  @JoinColumn({ name: 'cohortId' })
  cohort!: Cohort;

  @Column()
  cohortId!: string;

  @ManyToOne(() => Beneficiary)
  @JoinColumn({ name: 'beneficiaryId' })
  beneficiary!: Beneficiary;

  @Column()
  beneficiaryId!: string;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true, transformer: decimalTransformer })
  attendanceRate!: number;

  @Column({ default: false })
  completed!: boolean;

  @Column({ default: false })
  certified!: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  completedAt!: Date;
}
