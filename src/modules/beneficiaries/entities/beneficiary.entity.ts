import {
  Entity,
  Column,
  ManyToOne,
  OneToOne,
  Index,
  JoinColumn,
} from 'typeorm';
import { BaseEntity } from '@/common/entities/base.entity';
import { Institution } from '@/modules/institutions/entities/institution.entity';
import { BeneficiarySkillsProfile } from './beneficiary-skills-profile.entity';
import { BeneficiaryIncubationProfile } from './beneficiary-incubation-profile.entity';
import { BeneficiaryAccelerationProfile } from './beneficiary-acceleration-profile.entity';
import {
  Pillar,
  BeneficiaryStatus,
  Gender,
  StateOfNigeria,
} from '@/common/enums/beneficiary.enum';

@Entity('beneficiaries')
@Index(['nin'], { unique: true })
@Index(['assignedInstitutionId', 'pillar'])
@Index(['email'], { unique: true })
@Index(['referenceId'], { unique: true })
export class Beneficiary extends BaseEntity {
  @Column({ unique: true })
  referenceId!: string;

  // ---- Section A: Demographics & Bio (NDPA-sensitive) ----
  @Column()
  fullName!: string;

  @Column({ type: 'date' })
  dateOfBirth!: Date;

  @Column({ type: 'enum', enum: Gender })
  gender!: Gender;

  @Column()
  phoneNumber!: string;

  @Column({ unique: true })
  email!: string;

  @Column({ select: false })
  nin!: string;

  @Column({ select: false, unique: true })
  ninHash!: string;

  @Column({ nullable: true })
  pwdAssistiveRequirement?: string;

  @Column({ default: false })
  isNeet!: boolean;

  @Column({ default: false })
  isCurrentStudent!: boolean;

  @Column({ nullable: true })
  institutionName?: string;

  @Column({ nullable: true })
  studentMatricNumber?: string;

  @Column({ default: false })
  isRecentGraduate!: boolean;

  @Column({ nullable: true })
  emergencyContactName?: string;

  @Column({ nullable: true })
  emergencyContactRelationship?: string;

  @Column({ nullable: true })
  emergencyContactPhone?: string;

  @Column({ type: 'enum', enum: StateOfNigeria })
  stateOfOrigin!: StateOfNigeria;

  @Column({ type: 'enum', enum: StateOfNigeria })
  stateOfResidence!: StateOfNigeria;

  @Column()
  lga!: string;

  @Column()
  homeAddress!: string;

  @Column({ type: 'enum', enum: Pillar })
  pillar!: Pillar;

  @ManyToOne(() => Institution, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'preferredInstitutionId' })
  preferredInstitution!: Institution;

  @Column()
  preferredInstitutionId!: string;

  @ManyToOne(() => Institution, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'assignedInstitutionId' })
  assignedInstitution?: Institution;

  @Column({ nullable: true })
  assignedInstitutionId?: string;

  @Column({ type: 'text', nullable: true })
  statementOfPurpose?: string;

  @Column({ default: false })
  ndprConsentGiven!: boolean;

  @Column({ default: false })
  codeOfConductAccepted!: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  signedAt?: Date;

  @Column({
    type: 'enum',
    enum: BeneficiaryStatus,
    default: BeneficiaryStatus.SUBMITTED,
  })
  status!: BeneficiaryStatus;

  // ---- Dynamic Pillar Profile Relationships ----
  @OneToOne(() => BeneficiarySkillsProfile, (profile) => profile.beneficiary, {
    cascade: true,
    nullable: true,
  })
  skillsProfile?: BeneficiarySkillsProfile;

  @OneToOne(
    () => BeneficiaryIncubationProfile,
    (profile) => profile.beneficiary,
    {
      cascade: true,
      nullable: true,
    },
  )
  incubationProfile?: BeneficiaryIncubationProfile;

  @OneToOne(
    () => BeneficiaryAccelerationProfile,
    (profile) => profile.beneficiary,
    {
      cascade: true,
      nullable: true,
    },
  )
  accelerationProfile?: BeneficiaryAccelerationProfile;
}
