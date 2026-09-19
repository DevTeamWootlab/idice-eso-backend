import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsOptional, IsUUID } from 'class-validator';
import { MatchStatus } from '../entities/match.entity';

export class CommitMatchesDto {
  @ApiPropertyOptional({
    type: [String],
    description: 'Proposed matches to approve. Omit to approve every proposed match.',
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
    description: 'GENERATED = proposed, awaiting approval; ACCEPTED = approved and committed',
  })
  status!: MatchStatus;
  @ApiPropertyOptional({ format: 'date-time', nullable: true, type: String })
  matchedAt!: string | null;
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
