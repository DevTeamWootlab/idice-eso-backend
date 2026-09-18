import { IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ReassignReviewerDto {
  @ApiProperty({ description: 'User ID of the reviewer being replaced' })
  @IsUUID()
  outgoingReviewerId!: string;

  @ApiProperty({ description: 'User ID of the incoming ROLE_SCORING_REVIEWER' })
  @IsUUID()
  incomingReviewerId!: string;
}
