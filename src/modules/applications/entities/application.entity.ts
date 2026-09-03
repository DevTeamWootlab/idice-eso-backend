import { Entity, Column, ManyToOne, OneToMany, Index, JoinColumn } from 'typeorm';
import { BaseEntity } from '@common/entities/base.entity';
import { ApplicationStatus } from '@/common/enums/application-status.enum';
import { User } from '@modules/users/entities/user.entity';
import { Institution } from '@modules/institutions/entities/institution.entity';
import { ApplicationDocument } from './application-document.entity';
import { ApplicationReference } from './application-reference.entity';
import { ApplicationPersonnel } from './application-personnel.entity';

@Entity('applications')
@Index(['status'])
@Index(['submittedByOrgId'])
export class Application extends BaseEntity {
  @Column({ unique: true })
  applicationRef!: string; // e.g. iDICE-ESO-BEN-2026-XXXXX, generated on submission

  @ManyToOne(() => User)
  @JoinColumn({ name: 'submittedByOrgId' })
  submittedByOrg!: User; // the ROLE_ESO account

  @Column()
  submittedByOrgId!: string;

  @ManyToOne(() => Institution, { nullable: true })
  @JoinColumn({ name: 'preferredInstitutionId' })
  preferredInstitution!: Institution; // Section C target CoE

  @Column({ nullable: true })
  preferredInstitutionId!: string;

  @Column({
    type: 'enum',
    enum: ApplicationStatus,
    default: ApplicationStatus.DRAFT,
  })
  status!: ApplicationStatus;

  @Column({ nullable: true })
  organisationName!: string;

  @Column({ nullable: true })
  organisationEmail!: string;

  @Column({ nullable: true })
  organisationPhone!: string;
  @Column({ nullable: true })
  cacRegistrationNumber!: string;

  @Column({ nullable: true })
  tin!: string;

  @Column({ nullable: true })
  taxClearanceExpiry!: Date;

  @Column({ nullable: true })
  operatingState!: string; // must match preferredInstitution.state for eligibility check #3

  @Column({ nullable: true })
  physicalAddress!: string;

  @Column({
    type: 'enum',
    enum: ['LESS_THAN_15_MINS', '15_30_MINS', 'OVER_30_MINS'],
    nullable: true,
  })
  proximityToHostInstitution!: string;

  @OneToMany(() => ApplicationPersonnel, (p) => p.application, {
    cascade: true,
  })
  keyPersonnel!: ApplicationPersonnel[];

  @Column({ type: 'text', nullable: true })
  experienceSummary!: string;

  @Column({ type: 'jsonb', nullable: true })
  pastAssignments!: {
    title: string;
    funder: string;
    year: number;
    beneficiaries: number;
  }[];

  @OneToMany(() => ApplicationReference, (r) => r.application, {
    cascade: true,
  })
  references!: ApplicationReference[];


  @Column({ default: false })
  conflictOfInterestDeclared!: boolean;

  @Column({ default: false })
  ndpaComplianceAccepted!: boolean;

  @Column({ default: false })
  brownfieldRestrictionAccepted!: boolean;

  @Column({ nullable: true })
  authorisedSignatoryName!: string; // typed name mapped to signature checkbox

  @Column({ type: 'timestamptz', nullable: true })
  signedAt!: Date;

  @OneToMany(() => ApplicationDocument, (d) => d.application, { cascade: true })
  documents!: ApplicationDocument[];

 
  @Column({ type: 'timestamptz', nullable: true })
  lastEditedAt!: Date;

  @Column({ nullable: true })
  lastEditedByUserId!: string;


  @Column({ type: 'timestamptz', nullable: true })
  submittedAt!: Date;

  @Column({ type: 'timestamptz', nullable: true })
  eligibilityDecidedAt!: Date;

  @Column({ type: 'timestamptz', nullable: true })
  shortlistedAt!: Date;
}
