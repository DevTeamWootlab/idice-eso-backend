import {
  IsOptional,
  IsString,
  IsEnum,
  IsInt,
  IsArray,
  IsBoolean,
  IsUrl,
  IsEmail,
  ValidateNested,
  Min,
  Max,
  IsDateString,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  RegistrationType,
  OrganisationType,
  SectorFocus,
  OperatingState,
  ProximityToHost,
} from '@/common/enums/application.enum';
import { MaxWords } from '@/common/validators/max-word.validator';

class ReferenceItemDto {
  @IsString()
  fullName!: string;

  @IsString()
  relationship!: string;

  @IsOptional()
  @IsString()
  organisationName?: string;

  @IsString()
  phoneNumber!: string;

  @IsEmail()
  email!: string;
}

export class SaveDraftDto {
  // Section A
  @IsOptional() @IsString() organisationLegalName?: string;
  @IsOptional() @IsEnum(RegistrationType) registrationType?: RegistrationType;
  @IsOptional()
  @IsInt()
  @Min(1900)
  @Max(new Date().getFullYear())
  yearEstablished?: number;
  @IsOptional() @IsEnum(OrganisationType) organisationType?: OrganisationType;
  @IsOptional() @IsUrl() websiteOrSocialHandle?: string;
  @IsOptional() @IsString() primaryContactName?: string;
  @IsOptional() @IsString() primaryContactRole?: string;
  @IsOptional() @IsString() primaryContactPhone?: string;
  @IsOptional() @IsEmail() primaryContactEmail?: string;

  // Section B
  @IsOptional()
  @IsArray()
  @IsEnum(OperatingState, { each: true })
  statesOfOperation?: OperatingState[];
  @IsOptional() @IsString() physicalAddress?: string;
  @IsOptional()
  @IsEnum(ProximityToHost)
  proximityToHostInstitution?: ProximityToHost;
  @IsOptional() @IsString() tin?: string;
  @IsOptional() @IsString() staffingSummary?: string;
  @IsOptional() @IsString() @IsDateString() taxClearanceExpiry?: string;
  @IsOptional() @IsString() taxClearanceCertificateUrl?: string;
  @IsOptional() @IsString() taxComplianceEvidenceUrl?: string;
  @IsOptional() @IsString() auditedAccountsUrl?: string;
  @IsOptional() @IsArray() @IsString({ each: true}) organogramUrl?: string;
  @IsOptional()
  @IsString()
  governanceStructure?: string;
  // Section C
  @IsOptional()
  @IsArray()
  @IsEnum(SectorFocus, { each: true })
  sectorFocus?: SectorFocus[];
  @IsOptional()
  @IsString()
  @MaxWords(500)
  programmeDeliveryTrackRecord?: string;
  @IsOptional() @IsString() @MaxWords(500) mentorshipIndustryNetwork?: string;
  @IsOptional()
  @IsString()
  @MaxWords(500)
  inclusionAccessibilityCapacity?: string;

  // Section D
  @IsOptional()
  @IsString()
  @MaxWords(500)
  existingInstitutionalRelationships?: string;
  @IsOptional()
  @IsString()
  @MaxWords(500)
  institutionalCoordinationPlan?: string;
  @IsOptional() @IsString() @MaxWords(500) staffFacultyEngagementPlan?: string;
  @IsOptional() @IsString() @MaxWords(500) beneficiaryReferralPlan?: string;

  // Section E
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReferenceItemDto)
  references?: ReferenceItemDto[];

  // Section F
  @IsOptional() @IsBoolean() hasConductedIncubation?: boolean;
  @IsOptional() @IsBoolean() hasConductedAcceleration?: boolean;
  @IsOptional() @IsString() @MaxWords(500) monitoringReportingSystems?: string;
  @IsOptional() @IsString() @MaxWords(500) sustainabilityPlan?: string;
  @IsOptional() @IsString() @MaxWords(500) employmentPathway?: string;

  // Section G
  @IsOptional() @IsBoolean() conflictOfInterestDeclared?: boolean;
  @IsOptional() @IsBoolean() safeguardingPolicyCommitted?: boolean;
  @IsOptional() @IsBoolean() genderInclusionPolicyCommitted?: boolean;
  @IsOptional() @IsBoolean() idiceReportingQaCommitted?: boolean;

  // Section H
  @IsOptional() @IsBoolean() ndpaComplianceAccepted?: boolean;
  @IsOptional() @IsBoolean() declarationOfAccuracyConfirmed?: boolean;
  @IsOptional() @IsBoolean() brownfieldRestrictionAccepted?: boolean;
  @IsOptional() @IsString() authorisedSignatoryName?: string;
  @IsOptional() @IsString() authorisedSignatoryTitle?: string;

  @IsOptional() @IsString() preferredInstitutionId?: string;
}
