import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateUserStatusDto {
  @ApiProperty({ description: 'true to reactivate, false to suspend the account', example: false })
  @IsBoolean()
  isActive!: boolean;

  @ApiPropertyOptional({
    description: 'Why the account is being deactivated. Recorded on the audit log entry.',
    example: 'Left the programme — replaced by a new Scoring Reviewer',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;

  @ApiPropertyOptional({
    description:
      'Deactivation only. Required (set true) when this account has open work tied to it (unscored ' +
      'assignments, or is the only active validator covering pending work in their assigned state) — the ' +
      "first attempt without it is refused with a 409 describing what's open, so this can't happen silently.",
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  acknowledgeOpenWork?: boolean;
}
