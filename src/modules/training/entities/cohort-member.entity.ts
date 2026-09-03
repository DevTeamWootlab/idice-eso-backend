import { Entity, Column, ManyToOne, Index, JoinColumn } from 'typeorm';
import { BaseEntity } from '@common/entities/base.entity';
import { Cohort } from './cohort.entity';
import { Beneficiary } from '@modules/beneficiaries/entities/beneficiary.entity';

@Entity('cohort_members')
@Index(['cohortId', 'beneficiaryId'], { unique: true })
export class CohortMember extends BaseEntity {
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

  @Column({ type: 'date', nullable: true })
  enrolledAt!: Date;

  @Column({ default: true })
  isActive!: boolean;
}
