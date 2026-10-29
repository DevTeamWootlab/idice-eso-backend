import { Entity, Column, OneToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '@/common/entities/base.entity';
import { Beneficiary } from './beneficiary.entity';

@Entity('beneficiary_acceleration_profiles')
export class BeneficiaryAccelerationProfile extends BaseEntity {
  @OneToOne(
    () => Beneficiary,
    (beneficiary) => beneficiary.accelerationProfile,
    { onDelete: 'CASCADE' },
  )
  @JoinColumn({ name: 'beneficiaryId' })
  beneficiary!: Beneficiary;

  @Index({ unique: true })
  @Column()
  beneficiaryId!: string;

  @Column()
  registeredBusinessName!: string;

  @Column({ type: 'varchar', unique: true, nullable: true })
  cacRegistrationNumber!: string | null;

  @Column({ type: 'int', nullable: true })
  yearFounded!: number | null;

  @Column()
  sector!: string;

  @Column({ type: 'int', nullable: true })
  employeeCount?: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  estimatedMonthlyRevenueNgn?: number;

  @Column({ type: 'text', nullable: true })
  keyTraction?: string;

  @Column({ default: false })
  hasRaisedExternalFunding!: boolean;

  @Column({ nullable: true })
  fundingSourceDetails?: string;

  @Column({ type: 'varchar', nullable: true })
  primaryGrowthChallenge!: string | null;

  @Column({ type: 'simple-array', nullable: true })
  supportNeeded?: string[];

  @Column({ type: 'text', nullable: true })
  twelveMonthGrowthTarget?: string;

  @Column({ nullable: true })
  liveProductUrl?: string;

  @Column({ nullable: true })
  pitchDeckStorageKey?: string;

  @Column({ type: 'varchar', nullable: true })
  developmentStage!: string | null;

  @Column({ type: 'int', nullable: true })
  teamSize!: number | null;

  @Column({ type: 'varchar', nullable: true })
  cacDocumentStorageKey!: string | null;

  @Column({ type: 'jsonb', nullable: true })
  details!: Record<string, unknown> | null;
}
