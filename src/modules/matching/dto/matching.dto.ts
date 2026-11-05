import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsBoolean, IsNotEmpty, IsString, IsOptional, IsUUID, MinLength, MaxLength } from 'class-validator';
import { MatchSource, MatchStatus } from '../entities/match.entity';

export class AssignableCandidateDto {
  @ApiProperty({ format: 'uuid' })
  applicationId!: string;

  @ApiProperty({ example: 'Ilorin Innovation Hub Ltd/GTE' })
  organisationLegalName!: string;

  @ApiProperty({ type: Number, nullable: true, example: 92.5 })
  finalScorePercent!: number | null;

  @ApiProperty({ format: 'uuid', description: 'The institution this ESO originally applied to' })
  appliedToInstitutionId!: string;

  @ApiProperty({ example: 79, description: 'Match Compatibility Index against this institution (0-100)' })
  matchCompatibilityIndex!: number;

  @ApiProperty({ example: 100 })
  hubAlignmentScore!: number;

  @ApiProperty({ example: 70 })
  capacityAlignment!: number;

  @ApiProperty({ example: 60 })
  institutionalRelationshipScore!: number;

  @ApiPropertyOptional({ nullable: true, type: String, example: 'University of Ilorin' })
  appliedToInstitutionName!: string | null;

  @ApiPropertyOptional({ nullable: true, type: String, example: 'Kwara', description: "The ESO's state (state of the Centre of Excellence it applied to)" })
  state!: string | null;

  @ApiProperty({ description: 'true when the ESO is from a different state than this institution' })
  isCrossState!: boolean;

  @ApiProperty({ description: 'true when the ESO is the current pairing for this institution' })
  isCurrentMatch!: boolean;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Set when the ESO is already in a suggested, staged or approved pairing. Such ESOs cannot be assigned until that pairing is overridden or withdrawn.',
    example: { matchId: 'uuid', institutionId: 'uuid', institutionName: 'University of Ilorin', status: 'GENERATED' },
  })
  pairedWith!: { matchId: string; institutionId: string; institutionName: string | null; status: MatchStatus } | null;
}

export class UnmatchedApplicationDto {
  @ApiProperty({ format: 'uuid' })
  applicationId!: string;

  @ApiProperty({ example: 'IDICE-NC-0001' })
  applicationRef!: string;

  @ApiPropertyOptional({ nullable: true, type: String })
  organisationName!: string | null;

  @ApiPropertyOptional({ nullable: true, type: Number, example: 68.5 })
  finalScorePercent!: number | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true, type: String, description: 'Centre of Excellence the ESO applied to, if any' })
  institutionId!: string | null;

  @ApiPropertyOptional({ nullable: true, type: String })
  institutionName!: string | null;

  @ApiPropertyOptional({ nullable: true, type: String })
  state!: string | null;

  @ApiPropertyOptional({ nullable: true, type: Number })
  matchCompatibilityIndex!: number | null;

  @ApiProperty({
    example: 'Final score is below the 70% threshold',
    description:
      'Why there is no match: no Centre of Excellence selected, centre inactive, score below threshold, ' +
      'centre already taken, or ranked below the ESO proposed for the same centre.',
  })
  reason!: string;
}

export class CommitMatchesDto {
  @ApiPropertyOptional({
    type: [String],
    description: 'Proposed or staged matches to approve. Omit to approve every GENERATED and AWAITING_APPROVAL match.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @IsUUID('4', { each: true })
  matchIds?: string[];
}

class MatchApplicationDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;
  @ApiPropertyOptional({ nullable: true, type: String })
  organisationLegalName!: string | null;
  @ApiProperty()
  status!: string;
}

class MatchInstitutionDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;
  @ApiProperty()
  name!: string;
  @ApiProperty()
  state!: string;
  @ApiProperty({ enum: ['STANDARD', 'GAMING', 'VR', 'CREATIVE'] })
  hubType!: string;
}

class MatchBreakdownDto {
  @ApiProperty({ description: 'Sector focus vs hub type, 0–100' })
  hubAlignmentScore!: number;
  @ApiProperty({ description: 'Team expertise + delivery track record from the two score cards, 0–100' })
  capacityAlignment!: number;
  @ApiProperty({ description: 'Institutional alignment from the two score cards, 0–100' })
  institutionalRelationshipScore!: number;
}

export class MatchDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;
  @ApiProperty({ format: 'uuid' })
  applicationId!: string;
  @ApiPropertyOptional({ type: MatchApplicationDto })
  application?: MatchApplicationDto;
  @ApiProperty({ format: 'uuid' })
  institutionId!: string;
  @ApiPropertyOptional({ type: MatchInstitutionDto })
  institution?: MatchInstitutionDto;
  @ApiProperty({ description: 'Match Compatibility Index, 0–100' })
  matchCompatibilityIndex!: number;
  @ApiPropertyOptional({ type: MatchBreakdownDto, nullable: true })
  breakdown!: MatchBreakdownDto | null;
  @ApiProperty()
  state!: string;
  @ApiProperty({
    enum: MatchStatus,
    enumName: 'MatchStatus',
    example: MatchStatus.AWAITING_APPROVAL,
    description: 'GENERATED = system suggestion, AWAITING_APPROVAL = staged manual assignment, ACCEPTED = committed match, REJECTED = manually rejected',
  })
  status!: MatchStatus;
  @ApiPropertyOptional({ format: 'date-time', nullable: true, type: String })
  matchedAt!: string | null;

  @ApiProperty({ enum: MatchSource, enumName: 'MatchSource', description: 'SYSTEM suggestion or MANUAL override' })
  source!: MatchSource;
  
  @ApiPropertyOptional({ format: 'uuid', nullable: true, type: String, description: 'The suggested ESO this pairing replaced' })
  overriddenApplicationId!: string | null;
  
  @ApiPropertyOptional({ nullable: true, type: String, description: 'Reason given for the manual override' })
  overrideReason!: string | null;
  
  @ApiPropertyOptional({ format: 'uuid', nullable: true, type: String, description: 'SYSADMIN who staged the manual pairing' })
  assignedByUserId!: string | null;
}

class SkippedMatchDto {
  @ApiProperty({ format: 'uuid' })
  matchId!: string;
  @ApiProperty()
  reason!: string;
}

export class CommitMatchesResultDto {
  @ApiProperty({ description: 'How many matches were committed' })
  committed!: number;
  @ApiProperty({ type: [SkippedMatchDto], description: 'Proposals that could no longer be committed' })
  skipped!: SkippedMatchDto[];
  @ApiProperty({ type: [MatchDto], description: 'The full match list after committing' })
  matches!: MatchDto[];
}

export class ManualAssignDto {
  @ApiProperty({ format: 'uuid', description: 'The VALIDATED_SHORTLISTED application (ESO) to assign' })
  @IsUUID()
  applicationId!: string;

  @ApiProperty({
    minLength: 10,
    maxLength: 1000,
    description: 'Why the system suggestion is being overridden. Stored in the audit trail.',
    example: 'Higher final score (92.5%) and stronger delivery record than the suggested ESO.',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(10, { message: 'Please give a reason of at least 10 characters.' })
  @MaxLength(1000)
  reason!: string;

  @ApiPropertyOptional({
    default: false,
    description:
      'Bypass the same-state rule for this manual pairing. The cross-state exception, both states and the administrator are recorded in the audit trail.',
  })
  @IsOptional()
  @IsBoolean()
  allowCrossState?: boolean;
}

class OverviewMatchDto {
  @ApiPropertyOptional({ format: 'uuid', nullable: true, type: String, description: 'null for a legacy approved pairing without a match record' })
  id!: string | null;
  @ApiProperty({ format: 'uuid' })
  applicationId!: string;
  @ApiPropertyOptional({ nullable: true, type: String })
  organisationLegalName!: string | null;
  @ApiPropertyOptional({ nullable: true, type: Number })
  finalScorePercent!: number | null;
  @ApiPropertyOptional({ nullable: true, type: String, description: "The ESO's own state" })
  esoState!: string | null;
  @ApiProperty()
  isCrossState!: boolean;
  @ApiPropertyOptional({ nullable: true, type: Number })
  matchCompatibilityIndex!: number | null;
  @ApiProperty({ enum: MatchStatus, enumName: 'MatchStatus' })
  status!: MatchStatus;
  @ApiProperty({ enum: MatchSource, enumName: 'MatchSource' })
  source!: MatchSource;
  @ApiPropertyOptional({ format: 'uuid', nullable: true, type: String })
  overriddenApplicationId!: string | null;
  @ApiPropertyOptional({ nullable: true, type: String })
  overrideReason!: string | null;
  @ApiPropertyOptional({ format: 'date-time', nullable: true, type: String })
  matchedAt!: string | null;
}

class OverviewInstitutionDto {
  @ApiProperty({ format: 'uuid' })
  institutionId!: string;
  @ApiProperty()
  institutionName!: string;
  @ApiProperty()
  state!: string;
  @ApiProperty({ example: 'GAMING' })
  hubType!: string;
  @ApiProperty({ description: 'true when an unpaired, eligible ESO from the same state exists' })
  hasSameStateCandidate!: boolean;
  @ApiPropertyOptional({ type: OverviewMatchDto, nullable: true, description: 'null when the institution is unassigned' })
  match!: OverviewMatchDto | null;
}

class OverviewSummaryDto {
  @ApiProperty({ example: 11 }) institutions!: number;
  @ApiProperty({ example: 7 }) paired!: number;
  @ApiProperty({ example: 4 }) unassigned!: number;
  @ApiProperty({ example: 4 }) awaitingApproval!: number;
  @ApiProperty({ example: 3 }) approved!: number;
  @ApiProperty({ example: 1 }) manualOverrides!: number;
  @ApiProperty({ example: 1 }) crossState!: number;
  @ApiProperty({ example: 2, description: 'Validated ESOs (score of 70% or more) not in any pairing' }) availableEsos!: number;
}

export class MatchOverviewDto {
  @ApiProperty({ type: OverviewSummaryDto })
  summary!: OverviewSummaryDto;
  @ApiProperty({ type: [OverviewInstitutionDto], description: 'Every active Host Institution, paired or not' })
  institutions!: OverviewInstitutionDto[];
}