import { IsNumber, IsOptional, IsString, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SubmitScoreDto {
  @ApiProperty({
    description:
      'Local presence & relevance to state ecosystem (0-5, weight 20%)',
    minimum: 0,
    maximum: 5,
    example: 4,
  })
  @IsNumber()
  @Min(0)
  @Max(5)
  localPresenceScore!: number;

  @ApiProperty({
    description: 'Strength of team expertise (0-5, weight 20%)',
    minimum: 0,
    maximum: 5,
    example: 4,
  })
  @IsNumber()
  @Min(0)
  @Max(5)
  teamExpertiseScore!: number;

  @ApiProperty({
    description: 'Startup incubation/acceleration experience (0-5, weight 15%)',
    minimum: 0,
    maximum: 5,
    example: 3,
  })
  @IsNumber()
  @Min(0)
  @Max(5)
  incubationExperienceScore!: number;

  @ApiProperty({
    description: 'ESO credibility, governance & compliance (0-5, weight 15%)',
    minimum: 0,
    maximum: 5,
    example: 3,
  })
  @IsNumber()
  @Min(0)
  @Max(5)
  credibilityGovernanceScore!: number;

  @ApiProperty({
    description: 'Programme delivery track record (0-5, weight 15%)',
    minimum: 0,
    maximum: 5,
    example: 4,
  })
  @IsNumber()
  @Min(0)
  @Max(5)
  deliveryTrackRecordScore!: number;

  @ApiProperty({
    description:
      'Institutional relationship & alignment with host institution (0-5, weight 15%)',
    minimum: 0,
    maximum: 5,
    example: 3,
  })
  @IsNumber()
  @Min(0)
  @Max(5)
  institutionalAlignmentScore!: number;

  @ApiPropertyOptional({
    description: 'Free-text reviewer comments/justification',
  })
  @IsOptional()
  @IsString()
  comments?: string;
}

export class CompletedQueueItemDto {
  @ApiProperty({
    example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    description: 'Application UUID',
  })
  applicationId!: string;

  @ApiProperty({
    example: 'IDICE-NC-KOG-0001',
    description: 'Human-readable application reference code',
  })
  applicationRef!: string;

  @ApiProperty({
    example: 'Mentor-Box Foundation',
    nullable: true,
    description: 'Legal name of the applicant organization',
  })
  organisationName!: string | null;

  @ApiProperty({
    example: 'IN_REVIEW_SCORING',
    description: 'Current overall status of the application',
  })
  status!: string;

  @ApiProperty({
    example: 85.5,
    nullable: true,
    description: 'Score percentage awarded by the current reviewer',
  })
  myScorePercent!: number | null;

  @ApiProperty({
    example: '2026-09-11T11:49:16.988Z',
    nullable: true,
    description: 'Timestamp when the reviewer submitted their scorecard',
  })
  mySubmittedAt!: string | null;

  @ApiProperty({
    example: 'REVIEWER_1',
    nullable: true,
    description: 'Assigned reviewer slot (e.g., REVIEWER_1 or REVIEWER_2)',
  })
  reviewerSlot!: string | null;

  @ApiProperty({
    example: 88.0,
    nullable: true,
    description:
      'Final aggregated percentage score (null if co-review is still pending)',
  })
  finalScorePercent!: number | null;

  @ApiProperty({
    example: true,
    description: 'Indicates whether the final aggregated score is published',
  })
  finalScorePublished!: boolean;

  @ApiProperty({
    example: false,
    description:
      'Indicates whether the application is waiting on the co-reviewer to submit',
  })
  awaitingCoReviewer!: boolean;
}

export class PaginationMetaDto {
  @ApiProperty({
    example: 42,
    description: 'Total number of matching completed records',
  })
  total!: number;

  @ApiProperty({ example: 1, description: 'Current page number' })
  page!: number;

  @ApiProperty({ example: 20, description: 'Number of records per page' })
  limit!: number;

  @ApiProperty({ example: 3, description: 'Total number of available pages' })
  totalPages!: number;
}

export class PaginatedCompletedQueueResponseDto {
  @ApiProperty({ type: [CompletedQueueItemDto] })
  data!: CompletedQueueItemDto[];

  @ApiProperty({ type: PaginationMetaDto })
  meta!: PaginationMetaDto;
}