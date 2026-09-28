import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ApplicantActivityEventDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Passed eligibility review' })
  label!: string;

  @ApiProperty({ format: 'date-time' })
  occurredAt!: string;
}

export class ApplicantMatchInstitutionDto {
  @ApiProperty({ example: 'Benue State University' })
  name!: string;

  @ApiProperty({ example: 'Benue' })
  state!: string;

  @ApiProperty({ enum: ['STANDARD', 'GAMING', 'VR', 'CREATIVE'] })
  hubType!: string;
}

export class ApplicantMatchDto {
  @ApiProperty({
    description:
      'True only once the application has reached MATCHED. Draft (unconfirmed) matches and match scores are never exposed to applicants.',
  })
  matched!: boolean;

  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  matchedAt!: string | null;

  @ApiPropertyOptional({ type: ApplicantMatchInstitutionDto, nullable: true })
  institution!: ApplicantMatchInstitutionDto | null;
}

export class AdminApplicationStatsDto {
  @ApiProperty({ description: 'Every application that has left DRAFT' })
  total!: number;

  @ApiProperty()
  drafts!: number;

  @ApiProperty({
    description: 'Zero-filled count per ApplicationStatus',
    type: 'object',
    additionalProperties: { type: 'number' },
  })
  byStatus!: Record<string, number>;

  @ApiProperty({
    description:
      'Applications in IN_REVIEW_SCORING that do not yet have two scoring reviewers assigned (they cannot progress until an administrator assigns them)',
  })
  awaitingReviewerAssignment!: number;
}

export class ApplicationInstitutionRefDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;
  @ApiProperty()
  name!: string;
  @ApiProperty()
  state!: string;
}

export class ApplicationSummaryDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;
  @ApiProperty({ example: 'IDICE-NC-2026-0001' })
  applicationRef!: string;
  @ApiProperty({ description: 'ApplicationStatus' })
  status!: string;
  @ApiProperty()
  version!: number;
  @ApiProperty({ format: 'uuid' })
  submittedByOrgId!: string;
  @ApiProperty({ type: String, nullable: true })
  organisationLegalName!: string | null;
  @ApiProperty({ type: [String], description: 'OperatingState values' })
  statesOfOperation!: string[];
  @ApiProperty({ type: String, nullable: true })
  primaryContactEmail!: string | null;
  @ApiProperty({ type: Number, nullable: true })
  finalScorePercent!: number | null;
  @ApiProperty({ type: String, nullable: true, description: 'Set when score finalization failed or a scoring-gate rejection needs review' })
  scoringIntegrityError!: string | null;
  @ApiProperty({ format: 'date-time', nullable: true, type: String })
  submittedAt!: string | null;
  @ApiProperty({ format: 'date-time' })
  createdAt!: string;
  @ApiProperty({ format: 'date-time' })
  updated_at!: string;
  @ApiProperty({ type: ApplicationInstitutionRefDto, nullable: true })
  preferredInstitution!: ApplicationInstitutionRefDto | null;
}

export class AdminApplicationListDto {
  @ApiProperty({ type: [ApplicationSummaryDto] })
  items!: ApplicationSummaryDto[];
  @ApiProperty()
  total!: number;
  @ApiProperty()
  page!: number;
  @ApiProperty()
  limit!: number;
  @ApiProperty()
  totalPages!: number;
}

export class CompletenessResultDto {
  @ApiProperty({ description: 'True when the application can be submitted' })
  complete!: boolean;

  @ApiProperty({
    type: [String],
    example: ['Section B: Physical address', 'Section G: Budget'],
    description: 'What is still missing, in the wording the submit check uses',
  })
  missing!: string[];
}
