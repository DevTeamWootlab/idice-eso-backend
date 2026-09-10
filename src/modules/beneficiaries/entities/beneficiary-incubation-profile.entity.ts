import { Entity, Column, OneToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '@/common/entities/base.entity';
import { Beneficiary } from './beneficiary.entity';
import { IncubationStage } from '@/common/enums/beneficiary.enum';

@Entity('beneficiary_incubation_profiles')
export class BeneficiaryIncubationProfile extends BaseEntity {
  @OneToOne(() => Beneficiary, (beneficiary) => beneficiary.incubationProfile, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'beneficiaryId' })
  beneficiary!: Beneficiary;

  @Index({ unique: true })
  @Column()
  beneficiaryId!: string;

  @Column({ nullable: true })
  ventureName?: string;

  @Column()
  sectorFocus!: string;

  @Column({ type: 'text' })
  problemStatement!: string;

  @Column({ type: 'text' })
  proposedSolution!: string;

  @Column()
  targetCustomer!: string;

  @Column({ type: 'enum', enum: IncubationStage })
  currentStage!: IncubationStage;

  @Column({ type: 'text' })
  teamSizeAndRoles!: string;

  @Column({ nullable: true })
  technologyPlatform?: string;

  @Column({ type: 'simple-array', nullable: true })
  supportNeeded?: string[];

  @Column({ default: false })
  availableForFullDuration!: boolean;
}
