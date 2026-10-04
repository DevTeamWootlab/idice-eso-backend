import { Entity, Column, ManyToOne, OneToMany, Index } from 'typeorm';
import { BaseEntity } from '@/common/entities/base.entity';
import {
  ApplicationStatus,
  RegistrationType,
  OrganisationType,
  SectorFocus,
  OperatingState,
  ProximityToHost,
} from '@/common/enums/application.enum';
import { User } from '../../users/entities/user.entity';
import { Institution } from '../../institutions/entities/institution.entity';
import { ApplicationDocument } from './application-document.entity';
import { ApplicationReference } from './application-reference.entity';
import { ApplicationPersonnel } from './application-personnel.entity';
import { ScoreCard } from '../../scoring/entities/score-card.entity';
import { decimalTransformer } from '@/common/utils/decimal.transformer';

@Entity('applications')
@Index(['status'])
@Index(['submittedByOrgId'])
export class Application extends BaseEntity {
  @Column({ unique: true })
  applicationRef!: string;

  @ManyToOne(() => User)
  submittedByOrg!: User;

  @Column()
  submittedByOrgId!: string;

  @ManyToOne(() => Institution, { nullable: true })
  preferredInstitution!: Institution;

  @Column({ nullable: true })
  preferredInstitutionId!: string;

  @Column({
    type: 'enum',
    enum: ApplicationStatus,
    default: ApplicationStatus.DRAFT,
  })
  status!: ApplicationStatus;

  // ---- Section A: Organisation Identity ----
  @Column({ nullable: true })
  organisationLegalName!: string;

  @Column({ type: 'enum', enum: RegistrationType, nullable: true })
  registrationType!: RegistrationType;

  @Column({ type: 'int', nullable: true })
  yearEstablished!: number;

  @Column({ type: 'enum', enum: OrganisationType, nullable: true })
  organisationType!: OrganisationType;

  @Column({ nullable: true })
  websiteOrSocialHandle!: string;

  @Column({ nullable: true })
  primaryContactName!: string;

  @Column({ nullable: true })
  primaryContactRole!: string;

  @Column({ nullable: true })
  primaryContactPhone!: string;

  @Column({ nullable: true })
  primaryContactEmail!: string;

  // ---- Section B: Compliance & Operational Presence ----
  @Column({ type: 'enum', enum: OperatingState, array: true, nullable: true })
  statesOfOperation!: OperatingState[];

  @Column({ type: 'text', nullable: true })
  physicalAddress!: string;

  @Column({ type: 'enum', enum: ProximityToHost, nullable: true })
  proximityToHostInstitution!: ProximityToHost;

  @Column({ nullable: true })
  tin!: string;

  @Column({ nullable: true })
  staffingSummary!: string;

  @Column({ type: 'date', nullable: true })
  taxClearanceExpiry!: Date;

  @Column({ nullable: true })
  taxClearanceCertificateUrl!: string;

  @Column({ nullable: true })
  taxComplianceEvidenceUrl!: string;

  @Column({ nullable: true })
  auditedAccountsUrl!: string;

  @Column({ nullable: true })
  organogramUrl!: string;

  @Column({ type: 'jsonb', nullable: true })
  personnelCvUrls!: string[];

  @Column({ type: 'text', nullable: true })
  governanceStructure!: string;

  // ---- Section C: Programme Delivery ----
  @Column({ type: 'enum', enum: SectorFocus, array: true, nullable: true })
  sectorFocus!: SectorFocus[];

  @Column({ type: 'text', nullable: true })
  programmeDeliveryTrackRecord!: string;

  @Column({ type: 'text', nullable: true })
  mentorshipIndustryNetwork!: string;

  @Column({ type: 'text', nullable: true })
  inclusionAccessibilityCapacity!: string;

  // ---- Section D: Institutional Alignment ----
  @Column({ type: 'text', nullable: true })
  existingInstitutionalRelationships!: string;

  @Column({ type: 'text', nullable: true })
  institutionalCoordinationPlan!: string;

  @Column({ type: 'text', nullable: true })
  staffFacultyEngagementPlan!: string;

  @Column({ type: 'text', nullable: true })
  beneficiaryReferralPlan!: string;

  // ---- Section E: References ----
  @OneToMany(() => ApplicationReference, (r) => r.application, {
    cascade: true,
  })
  references!: ApplicationReference[];

  // ---- Section F: Experience & Industry Linkage ----
  @Column({ default: false })
  hasConductedIncubation!: boolean;

  @Column({ default: false })
  hasConductedAcceleration!: boolean;

  @Column({ type: 'text', nullable: true })
  monitoringReportingSystems!: string;

  @Column({ type: 'text', nullable: true })
  sustainabilityPlan!: string;

  @Column({ type: 'text', nullable: true })
  employmentPathway!: string;

  // ---- Section G: Policies & Declarations ----
  @Column({ default: false })
  conflictOfInterestDeclared!: boolean;

  @Column({ default: false })
  safeguardingPolicyCommitted!: boolean;

  @Column({ default: false })
  genderInclusionPolicyCommitted!: boolean;

  @Column({ default: false })
  idiceReportingQaCommitted!: boolean;

  // ---- Section H: Consent & Signature ----
  @Column({ default: false })
  ndpaComplianceAccepted!: boolean;

  @Column({ default: false })
  declarationOfAccuracyConfirmed!: boolean;

  @Column({ default: false })
  brownfieldRestrictionAccepted!: boolean;

  @Column({ nullable: true })
  authorisedSignatoryName!: string;

  @Column({ nullable: true })
  authorisedSignatoryTitle!: string;

  @Column({ type: 'timestamptz', nullable: true })
  signedAt!: Date;

  // ---- Documents & Personnel (span multiple sections) ----
  @OneToMany(() => ApplicationDocument, (d) => d.application, { cascade: true })
  documents!: ApplicationDocument[];

  @OneToMany(() => ApplicationPersonnel, (p) => p.application, {
    cascade: true,
  })
  keyPersonnel!: ApplicationPersonnel[];

  // Not eagerly loaded — callers opt in via `relations: { scoreCards: true }` only once
  // it's safe to unblind (see ScoringService.getDossier / ValidationService.getDossier).
  @OneToMany(() => ScoreCard, (s) => s.application)
  scoreCards?: ScoreCard[];

  // ---- Concurrency / auto-save ----
  @Column({ type: 'timestamptz', nullable: true })
  lastEditedAt!: Date;

  @Column({ nullable: true })
  lastEditedByUserId!: string;

  // ---- Funnel timestamps ----
  @Column({ type: 'timestamptz', nullable: true })
  submittedAt!: Date;

  @Column({ type: 'timestamptz', nullable: true })
  eligibilityDecidedAt!: Date;

  @Column({ type: 'timestamptz', nullable: true })
  shortlistedAt!: Date;

  // ---- Technical scoring outcome (persisted once both reviewers submit, or once a
  // >15% variance is reconciled by the Validator / Lead Evaluator) ----
  @Column({
    type: 'decimal',
    precision: 5,
    scale: 2,
    nullable: true,
    transformer: decimalTransformer,
  })
  finalScorePercent!: number | null;

  @Column({ default: false })
  scoreVarianceFlagged!: boolean;

  @Column({ type: 'text', nullable: true })
  scoringIntegrityError!: string | null;

  @Column({ type: 'text', nullable: true })
  scoreVarianceResolutionNote!: string | null;

  // @Column({ nullable: true })
  // scoreVarianceResolvedByUserId!: string | null;
  @Column({ type: 'uuid', nullable: true })
  scoreVarianceResolvedByUserId!: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  scoreVarianceResolvedAt!: Date | null;

  // ---- Partner Match Engine outcome ----
  @Column({ type: 'timestamptz', nullable: true })
  matchedAt!: Date | null;
}
