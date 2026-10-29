import { ApiProperty } from '@nestjs/swagger';
import {
  BeneficiaryStatus,
  Gender,
  Pillar,
  StateOfNigeria,
  TrainingTier,
  PreferredHubType,
} from '@/common/enums/beneficiary.enum';

export class EsoInstitutionRefDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;
  @ApiProperty()
  name!: string;
  @ApiProperty()
  state!: string;
}

export class EsoBeneficiarySkillsDto {
  @ApiProperty({ enum: PreferredHubType })
  preferredHubType!: PreferredHubType;
  @ApiProperty({ enum: TrainingTier })
  skillTier!: TrainingTier;
  @ApiProperty()
  specificSkillArea!: string;
  @ApiProperty({ nullable: true })
  priorExperience!: string | null;
  @ApiProperty()
  highestEducationLevel!: string;
  @ApiProperty()
  ownsPersonalDevice!: boolean;
  @ApiProperty()
  hasReliableInternet!: boolean;
  @ApiProperty({ nullable: true })
  portfolioLink!: string | null;
  @ApiProperty({ nullable: true })
  focusArea!: string | null;
  @ApiProperty({ nullable: true })
  preferredSkill!: string | null;
  @ApiProperty({ nullable: true })
  experienceLevel!: string | null;
  @ApiProperty({ nullable: true })
  knowledgeRating!: number | null;
  @ApiProperty({ type: [String], nullable: true })
  coursesTaken!: string[] | null;
  @ApiProperty({ nullable: true })
  confidenceRating!: number | null;
  @ApiProperty({ nullable: true })
  practicalApplication!: string | null;
  @ApiProperty({ nullable: true })
  independence!: string | null;
  @ApiProperty({ nullable: true })
  deliveryFormat!: string | null;
  @ApiProperty({ nullable: true })
  hasSmartphone!: boolean | null;
  @ApiProperty({ nullable: true })
  hasBackupPower!: boolean | null;
}

export class EsoBeneficiaryIncubationDto {
  @ApiProperty({ nullable: true })
  ventureName!: string | null;
  @ApiProperty()
  sectorFocus!: string;
  @ApiProperty()
  problemStatement!: string;
  @ApiProperty()
  proposedSolution!: string;
  @ApiProperty()
  targetCustomer!: string;
  @ApiProperty({ example: 'Prototype' })
  currentStage!: string;
  @ApiProperty()
  teamSizeAndRoles!: string;
  @ApiProperty({ nullable: true })
  technologyPlatform!: string | null;
  @ApiProperty({ type: [String], nullable: true })
  supportNeeded!: string[] | null;
  @ApiProperty()
  availableForFullDuration!: boolean;
  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    nullable: true,
    description: 'Every PRD Version 2 incubation answer. Uploaded files are left out of the ESO view.',
  })
  details!: Record<string, unknown> | null;
}

export class EsoBeneficiaryAccelerationDto {
  @ApiProperty()
  registeredBusinessName!: string;
  @ApiProperty({ nullable: true })
  cacRegistrationNumber!: string | null;
  @ApiProperty({ nullable: true })
  yearFounded!: number | null;
  @ApiProperty()
  sector!: string;
  @ApiProperty({ nullable: true })
  employeeCount!: number | null;
  @ApiProperty({ nullable: true })
  estimatedMonthlyRevenueNgn!: number | null;
  @ApiProperty({ nullable: true })
  keyTraction!: string | null;
  @ApiProperty()
  hasRaisedExternalFunding!: boolean;
  @ApiProperty({ nullable: true })
  fundingSourceDetails!: string | null;
  @ApiProperty({ nullable: true })
  primaryGrowthChallenge!: string | null;
  @ApiProperty({ type: [String], nullable: true })
  supportNeeded!: string[] | null;
  @ApiProperty({ nullable: true })
  twelveMonthGrowthTarget!: string | null;
  @ApiProperty({ nullable: true })
  liveProductUrl!: string | null;
  // The stored pitch deck itself is not handed to the ESO here — just whether one is on
  // file. There's no ESO-facing download route for it (it is neither an application
  // document nor an eligibility exhibit), so nothing links to it yet.
  @ApiProperty()
  hasPitchDeck!: boolean;
  @ApiProperty({ nullable: true, example: 'EARLY_REVENUE' })
  developmentStage!: string | null;
  @ApiProperty({ nullable: true, example: 4 })
  teamSize!: number | null;
  @ApiProperty()
  hasCacDocument!: boolean;
  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    nullable: true,
    description: 'Every PRD C2 acceleration answer. Uploaded files are left out of the ESO view.',
  })
  details!: Record<string, unknown> | null;
}

/**
 * What a matched ESO sees for one beneficiary allocated to their Centre of Excellence.
 * Deliberately narrower than the ROLE_SYSADMIN admin view: no NIN/NIN hash (never
 * selected off the entity), no home address, no emergency contact — an ESO needs enough
 * to run training/incubation/acceleration for this cohort member, not their full KYC
 * dossier.
 */
export class EsoBeneficiaryDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;
  @ApiProperty({ example: 'iDICE-ESONC-2026-7KQ2M' })
  referenceId!: string;
  @ApiProperty()
  fullName!: string;
  @ApiProperty({ nullable: true })
  firstName!: string | null;
  @ApiProperty({ nullable: true })
  middleName!: string | null;
  @ApiProperty({ nullable: true })
  lastName!: string | null;
  @ApiProperty({ enum: Gender })
  gender!: Gender;
  @ApiProperty()
  email!: string;
  @ApiProperty()
  phoneNumber!: string;
  @ApiProperty()
  isNeet!: boolean;
  @ApiProperty()
  isCurrentStudent!: boolean;
  @ApiProperty()
  isRecentGraduate!: boolean;
  @ApiProperty({ nullable: true })
  academicStatus!: string | null;
  @ApiProperty({ nullable: true, example: 'UNEMPLOYED' })
  employmentStatus!: string | null;
  @ApiProperty({ nullable: true, example: 'BSc/BA' })
  highestEducationLevel!: string | null;
  @ApiProperty({ nullable: true })
  institutionName!: string | null;
  @ApiProperty({ nullable: true })
  studentMatricNumber!: string | null;
  @ApiProperty({ nullable: true, example: '300 Level' })
  studentLevel!: string | null;
  @ApiProperty({ nullable: true, description: 'Set only when the applicant identified as a Person With Disability.' })
  pwdAssistiveRequirement!: string | null;
  @ApiProperty({ enum: StateOfNigeria })
  stateOfOrigin!: StateOfNigeria;
  @ApiProperty({ enum: StateOfNigeria })
  stateOfResidence!: StateOfNigeria;
  @ApiProperty()
  lga!: string;
  @ApiProperty({ enum: Pillar })
  pillar!: Pillar;
  @ApiProperty({ enum: BeneficiaryStatus, description: 'Always ALLOCATED in this list — see listForEso.' })
  status!: BeneficiaryStatus;
  @ApiProperty({ nullable: true, format: 'date-time' })
  allocatedAt!: string | null;
  @ApiProperty({ nullable: true })
  statementOfPurpose!: string | null;
  @ApiProperty({ type: EsoBeneficiarySkillsDto, nullable: true })
  skillsProfile!: EsoBeneficiarySkillsDto | null;
  @ApiProperty({ type: EsoBeneficiaryIncubationDto, nullable: true })
  incubationProfile!: EsoBeneficiaryIncubationDto | null;
  @ApiProperty({ type: EsoBeneficiaryAccelerationDto, nullable: true })
  accelerationProfile!: EsoBeneficiaryAccelerationDto | null;
}

export class EsoBeneficiaryListDto {
  @ApiProperty({ type: EsoInstitutionRefDto })
  institution!: EsoInstitutionRefDto;
  @ApiProperty({ type: [EsoBeneficiaryDto] })
  items!: EsoBeneficiaryDto[];
}
