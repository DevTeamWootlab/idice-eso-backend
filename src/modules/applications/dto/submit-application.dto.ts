import { IsInt, IsOptional, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SubmitApplicationDto {
  @ApiProperty({ description: 'ID of the draft/rework application to submit' })
  @IsUUID()
  applicationId!: string;

  @ApiPropertyOptional({
    description:
      'Version last seen by the client (from the last read). If provided and stale, the ' +
      'submission is rejected with 409 Conflict instead of overwriting concurrent edits.',
    example: 3,
  })
  @IsOptional()
  @IsInt()
  expectedVersion?: number;
}
