import { IsNotEmpty, IsNumber, IsString, Max, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ResolveVarianceDto {
  @ApiProperty({
    description:
      'The Lead Evaluator\'s reconciled composite score (0-100) after reviewing both ' +
      'reviewers\' scorecards',
    minimum: 0,
    maximum: 100,
    example: 74.5,
  })
  @IsNumber()
  @Min(0)
  @Max(100)
  reconciledScorePercent!: number;

  @ApiProperty({
    description:
      'Mandatory reconciliation note explaining how the final score was reached — ' +
      'part of the audit trail for this escalation, same as rejection remarks elsewhere.',
    example:
      'Reviewer 2 under-scored Domain 6 (institutional alignment) — the MOU with the ' +
      'host institution was in the dossier but appears to have been missed.',
  })
  @IsString()
  @IsNotEmpty()
  note!: string;
}
