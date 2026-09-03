import { Entity, Column, ManyToOne, OneToOne, Index, JoinColumn } from 'typeorm';
import { BaseEntity } from '@common/entities/base.entity';
import { Institution } from '@modules/institutions/entities/institution.entity';
import {
  Pillar,
  BeneficiaryStatus,
} from '@common/enums/beneficiary.enum';

@Entity('beneficiaries')
@Index(['nin'], { unique: true }) // identity-deduplication key
@Index(['assignedInstitutionId', 'pillar']) // ESO cohort tab queries
export class Beneficiary extends BaseEntity {
  @Column({ unique: true })
  referenceId!: string; // iDICE-BEN-2026-XXXXX

  // ---- Section A: Demographics & Bio (NDPA-sensitive) ----
  @Column()
  fullName!: string;

  @Column({ type: 'date' })
  dateOfBirth!: Date;

  @Column()
  gender!: string;

  @Column()
  phoneNumber!: string;

  @Column({ unique: true })
  email!: string;

  @Column({ select: false }) 
  nin!: string; // TODO: field-level encryption

  @Column({ nullable: true })
  pwdAssistiveRequirement!: string;

  @Column({ default: false })
  isNeet!: boolean;

  @Column({ default: false })
  isCurrentStudent!: boolean;

  @Column({ nullable: true })
  institutionName!: string;

  @Column({ nullable: true })
  studentMatricNumber!: string;

  @Column({ default: false })
  isRecentGraduate!: boolean;


  @Column({ nullable: true })
  emergencyContactName!: string;

  @Column({ nullable: true })
  emergencyContactRelationship!: string;

  @Column({ nullable: true })
  emergencyContactPhone!: string;

 
  @Column()
  stateOfOrigin!: string;

  @Column()
  stateOfResidence!: string;

  @Column()
  lga!: string;

  @Column()
  homeAddress!: string;

 
  @Column({ type: 'enum', enum: Pillar })
  pillar!: Pillar;

  @ManyToOne(() => Institution)
  @JoinColumn({ name: 'preferredInstitutionId' })
  preferredInstitution!: Institution;

  @Column()
  preferredInstitutionId!: string;

  // Set by the geo-mapping/hub-allocation job
  @ManyToOne(() => Institution, { nullable: true })
  @JoinColumn({ name: 'assignedInstitutionId' })
  assignedInstitution!: Institution;

  @Column({ nullable: true })
  assignedInstitutionId!: string;


  @Column({ type: 'text', nullable: true })
  statementOfPurpose!: string; // max 150 words, enforced in DTO

  
  @Column({ default: false })
  ndprConsentGiven!: boolean;

  @Column({ default: false })
  codeOfConductAccepted!: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  signedAt!: Date;

  @Column({
    type: 'enum',
    enum: BeneficiaryStatus,
    default: BeneficiaryStatus.SUBMITTED,
  })
  status!: BeneficiaryStatus;
}
