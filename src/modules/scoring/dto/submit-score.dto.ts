import { IsNumber, IsOptional, IsString, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SubmitScoreDto {
  @ApiProperty({ description: 'Local presence & relevance to state ecosystem (0-5, weight 20%)', minimum: 0, maximum: 5, example: 4 })
  @IsNumber() @Min(0) @Max(5) localPresenceScore!: number;

  @ApiProperty({ description: 'Strength of team expertise (0-5, weight 20%)', minimum: 0, maximum: 5, example: 4 })
  @IsNumber() @Min(0) @Max(5) teamExpertiseScore!: number;

  @ApiProperty({ description: 'Startup incubation/acceleration experience (0-5, weight 15%)', minimum: 0, maximum: 5, example: 3 })
  @IsNumber() @Min(0) @Max(5) incubationExperienceScore!: number;

  @ApiProperty({ description: 'ESO credibility, governance & compliance (0-5, weight 15%)', minimum: 0, maximum: 5, example: 3 })
  @IsNumber() @Min(0) @Max(5) credibilityGovernanceScore!: number;

  @ApiProperty({ description: 'Programme delivery track record (0-5, weight 15%)', minimum: 0, maximum: 5, example: 4 })
  @IsNumber() @Min(0) @Max(5) deliveryTrackRecordScore!: number;

  @ApiProperty({ description: 'Institutional relationship & alignment with host institution (0-5, weight 15%)', minimum: 0, maximum: 5, example: 3 })
  @IsNumber() @Min(0) @Max(5) institutionalAlignmentScore!: number;

  @ApiPropertyOptional({ description: 'Free-text reviewer comments/justification' })
  @IsOptional()
  @IsString()
  comments?: string;
}
