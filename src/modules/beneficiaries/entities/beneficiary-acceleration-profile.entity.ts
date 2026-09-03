
import { Entity, Column, OneToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '@common/entities/base.entity';
import { Beneficiary } from './beneficiary.entity';

@Entity('beneficiary_acceleration_profiles')
export class BeneficiaryAccelerationProfile extends BaseEntity {
  @OneToOne(() => Beneficiary)
  @JoinColumn()
  beneficiary!: Beneficiary;

  @Column()
  beneficiaryId!: string;

  @Column()
  registeredBusinessName!: string;

  @Column()
  cacRegistrationNumber!: string;

  @Column({ type: 'int' })
  yearFounded!: number;

  @Column()
  sector!: string;

  @Column({ type: 'int', nullable: true })
  employeeCount!: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  estimatedMonthlyRevenueNgn!: number;

  @Column({ type: 'text', nullable: true })
  keyTraction!: string;

  @Column({ default: false })
  hasRaisedExternalFunding!: boolean;

  @Column({ nullable: true })
  fundingSourceDetails!: string;

  @Column()
  primaryGrowthChallenge!: string;

  @Column({ type: 'simple-array', nullable: true })
  supportNeeded!: string[];

  @Column({ type: 'text', nullable: true })
  twelveMonthGrowthTarget!: string;

  @Column({ nullable: true })
  liveProductUrl!: string;

  @Column({ nullable: true })
  pitchDeckStorageKey!: string;
}
