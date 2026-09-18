import { ArrayMaxSize, ArrayMinSize, IsArray, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AssignReviewersDto {
  @ApiProperty({
    description:
      'Exactly two distinct ROLE_SCORING_REVIEWER user IDs to assign as the blind dual reviewers',
    type: [String],
    minItems: 2,
    maxItems: 2,
  })
  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(2)
  @IsUUID(undefined, { each: true })
  reviewerIds!: string[];
}
