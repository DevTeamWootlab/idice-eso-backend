import { IsUUID } from 'class-validator';

export class ReassignReviewerDto {
  @IsUUID()
  outgoingReviewerId!: string;

  @IsUUID()
  incomingReviewerId!: string;
}
