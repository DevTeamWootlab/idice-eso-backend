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

  @Column({ type: 'varchar', nullable: true })
  focusArea?: string | null;

  @Column({ type: 'varchar', nullable: true })
  preferredSkill?: string | null;

  @Column({ type: 'varchar', nullable: true })
  experienceLevel?: string | null;

  @Column({ type: 'smallint', nullable: true })
  knowledgeRating?: number | null;

  @Column({ type: 'text', array: true, nullable: true })
  coursesTaken?: string[] | null;

  @Column({ type: 'smallint', nullable: true })
  confidenceRating?: number | null;

  @Column({ type: 'varchar', nullable: true })
  practicalApplication?: string | null;

  @Column({ type: 'varchar', nullable: true })
  independence?: string | null;

  @Column({ type: 'varchar', nullable: true })
  deliveryFormat?: string | null;

  @Column({ type: 'boolean', nullable: true })
  hasSmartphone?: boolean | null;

  @Column({ type: 'boolean', nullable: true })
  hasBackupPower?: boolean | null;
}
