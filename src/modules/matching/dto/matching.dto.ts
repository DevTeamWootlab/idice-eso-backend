import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsNotEmpty, IsString, IsOptional, IsUUID, MinLength, MaxLength } from 'class-validator';
import { MatchSource, MatchStatus } from '../entities/match.entity';

/** Response item for GET institutions/:institutionId/candidates */
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
}

/**
 * Response item for GET unmatched.
 * NOTE: shape is inferred from the endpoint description. Align it with what
 * MatchingService.getUnmatched() actually returns.
 */
export class UnmatchedApplicationDto {
  @ApiProperty({ format: 'uuid' })
  applicationId!: string;

  @ApiPropertyOptional({ nullable: true, type: String })
  organisationLegalName!: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true, type: String, description: 'Centre of Excellence the ESO applied to, if any' })
  preferredInstitutionId!: string | null;

  @ApiPropertyOptional({ nullable: true, type: Number, example: 68.5 })
  finalScorePercent!: number | null;

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

/** Request body for POST institutions/:institutionId/assign */
export class ManualAssignDto {
  @ApiProperty({ format: 'uuid', description: 'The VALIDATED_SHORTLISTED application (ESO) to assign' })
  @IsUUID()
  applicationId!: string;

  /** Shown in the audit trail and on the Awaiting approval row. */
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
}