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
import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  RegistrationType,
  OrganisationType,
  SectorFocus,
  OperatingState,
  ProximityToHost,
} from '@/common/enums/application.enum';
import { MaxWords } from '@/common/validators/max-word.validator';

class ReferenceItemDto {
  @ApiPropertyOptional({ description: 'Reference full name' })
  @IsString()
  fullName!: string;

  @ApiPropertyOptional({ description: 'Relationship to the applicant, e.g. "Client, Partner"' })
  @IsString()
  relationship!: string;

  @ApiPropertyOptional({ description: 'Organisation the reference belongs to' })
  @IsOptional()
  @IsString()
  organisationName?: string;

  @ApiPropertyOptional({ description: 'Reference phone number' })
  @IsString()
  phoneNumber!: string;

  @ApiPropertyOptional({ description: 'Reference email address' })
  @IsEmail()
  email!: string;
}

export class SaveDraftDto {
  // ---- Section A: Organisation Identity ----
  @ApiPropertyOptional({ description: 'Section A: Organisation legal name' })
  @IsOptional() @IsString() organisationLegalName?: string;

  @ApiPropertyOptional({ description: 'Section A: Registration type', enum: RegistrationType })
  @IsOptional() @IsEnum(RegistrationType) registrationType?: RegistrationType;

  @ApiPropertyOptional({ description: 'Section A: Year established', example: 2018 })
  @IsOptional()
  @IsInt()
  @Min(1900)
  @Max(new Date().getFullYear())
  yearEstablished?: number;

  @ApiPropertyOptional({ description: 'Section A: Organisation type', enum: OrganisationType })
  @IsOptional() @IsEnum(OrganisationType) organisationType?: OrganisationType;

  @ApiPropertyOptional({ description: 'Section A: Website or social handle' })
  @IsOptional() @IsUrl() websiteOrSocialHandle?: string;

  @ApiPropertyOptional({ description: 'Section A: Primary contact name' })
  @IsOptional() @IsString() primaryContactName?: string;

  @ApiPropertyOptional({ description: 'Section A: Primary contact role' })
  @IsOptional() @IsString() primaryContactRole?: string;

  @ApiPropertyOptional({ description: 'Section A: Primary contact phone' })
  @IsOptional() @IsString() primaryContactPhone?: string;

  @ApiPropertyOptional({ description: 'Section A: Primary contact email' })
  @IsOptional() @IsEmail() primaryContactEmail?: string;

  // ---- Section B: Compliance & Operational Presence ----
  @ApiPropertyOptional({ description: 'Section B: States of operation', enum: OperatingState, isArray: true })
  @IsOptional()
  @IsArray()
  @IsEnum(OperatingState, { each: true })
  statesOfOperation?: OperatingState[];

  @ApiPropertyOptional({ description: 'Section B: Physical address' })
  @IsOptional() @IsString() physicalAddress?: string;

  @ApiPropertyOptional({ description: 'Section B: Proximity to host institution', enum: ProximityToHost })
  @IsOptional()
  @IsEnum(ProximityToHost)
  proximityToHostInstitution?: ProximityToHost;

  @ApiPropertyOptional({ description: 'Section B: Tax Identification Number' })
  @IsOptional() @IsString() tin?: string;

  @ApiPropertyOptional({ description: 'Section B: Staffing summary (full-time/part-time counts as free text)' })
  @IsOptional() @IsString() staffingSummary?: string;

  @ApiPropertyOptional({ description: 'Section B: Tax clearance certificate expiry date (ISO 8601)' })
  @IsOptional() @IsString() @IsDateString() taxClearanceExpiry?: string;

  @ApiPropertyOptional({ description: 'Section B: Tax clearance certificate URL (legacy — superseded by the TAX_CLEARANCE document upload)' })
  @IsOptional() @IsString() taxClearanceCertificateUrl?: string;

  @ApiPropertyOptional({ description: 'Section B: Tax compliance evidence URL (legacy — superseded by the TAX_COMPLIANCE_EVIDENCE document upload)' })
  @IsOptional() @IsString() taxComplianceEvidenceUrl?: string;

  @ApiPropertyOptional({ description: 'Section B: Audited accounts URL (legacy — superseded by the AUDITED_ACCOUNTS document upload)' })
  @IsOptional() @IsString() auditedAccountsUrl?: string;

  @ApiPropertyOptional({ description: 'Section B: Organogram URL (legacy — superseded by the ORGANOGRAM document upload)' })
  @IsOptional() @IsString() organogramUrl?: string;

  @ApiPropertyOptional({ description: 'Section B: Governance structure' })
  @IsOptional()
  @IsString()
  governanceStructure?: string;

  // ---- Section C: Programme Delivery ----
  @ApiPropertyOptional({ description: 'Section C: Sector focus', enum: SectorFocus, isArray: true })
  @IsOptional()
  @IsArray()
  @IsEnum(SectorFocus, { each: true })
  sectorFocus?: SectorFocus[];

  @ApiPropertyOptional({ description: 'Section C: Programme delivery track record (max 500 words)' })
  @IsOptional()
  @IsString()
  @MaxWords(500)
  programmeDeliveryTrackRecord?: string;

  @ApiPropertyOptional({ description: 'Section C: Mentorship / industry network (max 500 words)' })
  @IsOptional() @IsString() @MaxWords(500) mentorshipIndustryNetwork?: string;

  @ApiPropertyOptional({ description: 'Section C: Inclusion & accessibility capacity (max 500 words)' })
  @IsOptional()
  @IsString()
  @MaxWords(500)
  inclusionAccessibilityCapacity?: string;

  // ---- Section D: Institutional Alignment ----
  @ApiPropertyOptional({ description: 'Section D: Existing institutional relationships (max 500 words)' })
  @IsOptional()
  @IsString()
  @MaxWords(500)
  existingInstitutionalRelationships?: string;

  @ApiPropertyOptional({ description: 'Section D: Institutional coordination plan (max 500 words)' })
  @IsOptional()
  @IsString()
  @MaxWords(500)
  institutionalCoordinationPlan?: string;

  @ApiPropertyOptional({ description: 'Section D: Staff/faculty engagement plan (max 500 words)' })
  @IsOptional() @IsString() @MaxWords(500) staffFacultyEngagementPlan?: string;

  @ApiPropertyOptional({ description: 'Section D: Beneficiary referral plan (max 500 words)' })
  @IsOptional() @IsString() @MaxWords(500) beneficiaryReferralPlan?: string;

  // ---- Section E: References ----
  @ApiPropertyOptional({ description: 'Section E: References (minimum 3 required to submit)', type: [ReferenceItemDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReferenceItemDto)
  references?: ReferenceItemDto[];

  // ---- Section F: Experience & Industry Linkage ----
  @ApiPropertyOptional({ description: 'Section F: Has conducted incubation before' })
  @IsOptional() @IsBoolean() hasConductedIncubation?: boolean;

  @ApiPropertyOptional({ description: 'Section F: Has conducted acceleration before' })
  @IsOptional() @IsBoolean() hasConductedAcceleration?: boolean;

  @ApiPropertyOptional({ description: 'Section F: Monitoring & reporting systems (max 500 words)' })
  @IsOptional() @IsString() @MaxWords(500) monitoringReportingSystems?: string;

  @ApiPropertyOptional({ description: 'Section F: Sustainability plan (max 500 words)' })
  @IsOptional() @IsString() @MaxWords(500) sustainabilityPlan?: string;

  @ApiPropertyOptional({ description: 'Section F: Employment pathway (max 500 words)' })
  @IsOptional() @IsString() @MaxWords(500) employmentPathway?: string;

  // ---- Section G: Policies & Declarations ----
  @ApiPropertyOptional({ description: 'Section G: Conflict of interest declared' })
  @IsOptional() @IsBoolean() conflictOfInterestDeclared?: boolean;

  @ApiPropertyOptional({ description: 'Section G: Safeguarding policy committed' })
  @IsOptional() @IsBoolean() safeguardingPolicyCommitted?: boolean;

  @ApiPropertyOptional({ description: 'Section G: Gender/inclusion policy committed' })
  @IsOptional() @IsBoolean() genderInclusionPolicyCommitted?: boolean;

  @ApiPropertyOptional({ description: 'Section G: iDICE reporting & QA commitment' })
  @IsOptional() @IsBoolean() idiceReportingQaCommitted?: boolean;

  // ---- Section H: Consent & Signature ----
  @ApiPropertyOptional({ description: 'Section H: NDPA 2023 consent accepted' })
  @IsOptional() @IsBoolean() ndpaComplianceAccepted?: boolean;

  @ApiPropertyOptional({ description: 'Section H: Declaration of accuracy confirmed' })
  @IsOptional() @IsBoolean() declarationOfAccuracyConfirmed?: boolean;

  @ApiPropertyOptional({ description: 'Section H: Brownfield restriction accepted' })
  @IsOptional() @IsBoolean() brownfieldRestrictionAccepted?: boolean;

  @ApiPropertyOptional({ description: 'Section H: Authorised signatory name' })
  @IsOptional() @IsString() authorisedSignatoryName?: string;

  @ApiPropertyOptional({ description: 'Section H: Authorised signatory title' })
  @IsOptional() @IsString() authorisedSignatoryTitle?: string;

  // ---- Section B (host institution selection) ----
  @ApiPropertyOptional({ description: 'Preferred Centre of Excellence — a real Institution UUID from GET /institutions/public' })
  @IsOptional() @IsString() preferredInstitutionId?: string;
}
