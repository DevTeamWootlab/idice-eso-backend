import { ApiProperty } from '@nestjs/swagger';
import { EmploymentOutcomeType } from '@/common/enums/outcomes.enum';

class OutcomeInstitutionDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;
  @ApiProperty()
  name!: string;
}

class OutcomeSummaryDto {
  @ApiProperty({ enum: EmploymentOutcomeType })
  outcomeType!: EmploymentOutcomeType;
  @ApiProperty({ type: String, nullable: true })
  employerOrVentureName!: string | null;
  @ApiProperty({ type: String, nullable: true, example: '2026-11-20' })
  achievedOn!: string | null;
  @ApiProperty()
  verified!: boolean;
}

export class OutcomeCandidateDto {
  @ApiProperty({ format: 'uuid' })
  beneficiaryId!: string;
  @ApiProperty()
  fullName!: string;
  @ApiProperty()
  referenceId!: string;
  @ApiProperty({ type: OutcomeInstitutionDto, nullable: true })
  institution!: OutcomeInstitutionDto | null;
  @ApiProperty({ type: String, nullable: true, format: 'date-time', description: 'Latest completion' })
  completedAt!: string | null;
  @ApiProperty({ type: OutcomeSummaryDto, nullable: true, description: 'null when nothing is recorded yet' })
  outcome!: OutcomeSummaryDto | null;
}

export class OutcomeCandidateListDto {
  @ApiProperty({ type: [OutcomeCandidateDto] })
  items!: OutcomeCandidateDto[];
  @ApiProperty()
  total!: number;
  @ApiProperty()
  page!: number;
  @ApiProperty()
  limit!: number;
  @ApiProperty()
  totalPages!: number;
}

export class EmploymentOutcomeDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;
  @ApiProperty({ format: 'uuid' })
  beneficiaryId!: string;
  @ApiProperty({ enum: EmploymentOutcomeType })
  outcomeType!: EmploymentOutcomeType;
  @ApiProperty({ type: String, nullable: true })
  employerOrVentureName!: string | null;
  @ApiProperty({ type: String, nullable: true })
  achievedOn!: string | null;
  @ApiProperty()
  verified!: boolean;
  @ApiProperty({ type: String, nullable: true, description: 'Administrator who verified it' })
  verifiedBy!: string | null;
}
