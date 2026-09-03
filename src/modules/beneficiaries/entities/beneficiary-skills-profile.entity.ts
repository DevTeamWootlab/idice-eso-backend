
import { Entity, Column, OneToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '@common/entities/base.entity';
import { Beneficiary } from './beneficiary.entity';
import { TrainingTier } from '@common/enums/beneficiary.enum';

@Entity('beneficiary_skills_profiles')
export class BeneficiarySkillsProfile extends BaseEntity {
  @OneToOne(() => Beneficiary)
  @JoinColumn()
  beneficiary!: Beneficiary;

  @Column()
  beneficiaryId!: string;

  @Column()
  preferredHubType!: string; // Standard / Gaming / VR / Creative

  @Column({ type: 'enum', enum: TrainingTier })
  skillTier!: TrainingTier; // drives the 60/30/10 course catalogue filter

  @Column()
  specificSkillArea!: string;

  @Column({ type: 'text', nullable: true })
  priorExperience!: string;

  @Column()
  highestEducationLevel!: string;

  @Column({ default: false })
  ownsPersonalDevice!: boolean;

  @Column({ default: false })
  hasReliableInternet!: boolean;

  @Column({ nullable: true })
  portfolioLink!: string;
}
