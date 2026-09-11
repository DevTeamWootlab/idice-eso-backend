import { IsNumber, Min, Max } from 'class-validator';

export class SubmitScoreDto {
  @IsNumber() @Min(0) @Max(5) localPresenceScore!: number;
  @IsNumber() @Min(0) @Max(5) teamExpertiseScore!: number;
  @IsNumber() @Min(0) @Max(5) incubationExperienceScore!: number;
  @IsNumber() @Min(0) @Max(5) credibilityGovernanceScore!: number;
  @IsNumber() @Min(0) @Max(5) deliveryTrackRecordScore!: number;
  @IsNumber() @Min(0) @Max(5) institutionalRelationshipScore!: number;
}
