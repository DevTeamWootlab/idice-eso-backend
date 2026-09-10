import { Entity, Column, OneToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '@/common/entities/base.entity';
import { Beneficiary } from './beneficiary.entity';
import {
  TrainingTier,
  PreferredHubType,
} from '@/common/enums/beneficiary.enum';

@Entity('beneficiary_skills_profiles')
export class BeneficiarySkillsProfile extends BaseEntity {
  @OneToOne(() => Beneficiary, (beneficiary) => beneficiary.skillsProfile, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'beneficiaryId' })
  beneficiary!: Beneficiary;

  @Index({ unique: true })
  @Column()
  beneficiaryId!: string;

  @Column({ type: 'enum', enum: PreferredHubType })
  preferredHubType!: PreferredHubType;

  @Column({ type: 'enum', enum: TrainingTier })
  skillTier!: TrainingTier;

  @Column()
  specificSkillArea!: string;

  @Column({ type: 'text', nullable: true })
  priorExperience?: string;

  @Column()
  highestEducationLevel!: string;

  @Column({ default: false })
  ownsPersonalDevice!: boolean;

  @Column({ default: false })
  hasReliableInternet!: boolean;

  @Column({ nullable: true })
  portfolioLink?: string;
}
