
import { Entity, Column, OneToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '@common/entities/base.entity';
import { Beneficiary } from './beneficiary.entity';

@Entity('beneficiary_incubation_profiles')
export class BeneficiaryIncubationProfile extends BaseEntity {
  @OneToOne(() => Beneficiary)
  @JoinColumn()
  beneficiary!: Beneficiary;

  @Column()
  beneficiaryId!: string;

  @Column({ nullable: true })
  ventureName!: string;

  @Column()
  sectorFocus!: string;

  @Column({ type: 'text' })
  problemStatement!: string;

  @Column({ type: 'text' })
  proposedSolution!: string;

  @Column()
  targetCustomer!: string;

  @Column({ type: 'enum', enum: ['IDEA', 'CONCEPT', 'EARLY_PROTOTYPE'] })
  currentStage!: string;

  @Column({ type: 'text' })
  teamSizeAndRoles!: string;

  @Column({ nullable: true })
  technologyPlatform!: string;

  @Column({ type: 'simple-array', nullable: true })
  supportNeeded!: string[]; // multi-select

  @Column({ default: false })
  availableForFullDuration!: boolean;
}
