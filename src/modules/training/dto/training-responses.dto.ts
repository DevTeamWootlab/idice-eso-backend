import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TrainingTier } from '@/common/enums/beneficiary.enum';
import { CohortStatus } from '@/common/enums/training.enum';
import { InstitutionRefDto } from '@/modules/beneficiaries/dto/beneficiary-responses.dto';

export class CourseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;
  @ApiProperty()
  title!: string;
  @ApiProperty({ enum: TrainingTier })
  tier!: TrainingTier;
  @ApiProperty({ type: String, nullable: true })
  hubType!: string | null;
  @ApiProperty({ type: Number, nullable: true })
  durationWeeks!: number | null;
}

export class CohortDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;
  @ApiProperty()
  name!: string;
  @ApiProperty({ format: 'uuid' })
  institutionId!: string;
  @ApiProperty({ type: String, nullable: true, format: 'uuid' })
  courseId!: string | null;
  @ApiProperty({ example: '2026-10-05' })
  startDate!: string;
  @ApiProperty({ type: String, nullable: true, example: '2026-12-18' })
  endDate!: string | null;
  @ApiProperty({ enum: CohortStatus })
  status!: CohortStatus;
  @ApiProperty({ description: '0 means no cap' })
  capacity!: number;
  @ApiPropertyOptional({ description: 'Active members (listing only)' })
  memberCount?: number;
  @ApiPropertyOptional({ type: InstitutionRefDto, description: 'Listing only' })
  institution?: InstitutionRefDto;
  @ApiPropertyOptional({ type: CourseDto, description: 'Listing only' })
  course?: CourseDto;
}

export class CohortMemberDto {
  @ApiProperty({ format: 'uuid' })
  beneficiaryId!: string;
  @ApiProperty()
  fullName!: string;
  @ApiProperty()
  referenceId!: string;
  @ApiProperty({ type: String, nullable: true, example: '2026-10-05' })
  enrolledAt!: string | null;
  @ApiProperty()
  isActive!: boolean;
  @ApiProperty()
  completed!: boolean;
  @ApiProperty()
  certified!: boolean;
  @ApiProperty({ type: Number, nullable: true, minimum: 0, maximum: 100 })
  attendanceRate!: number | null;
}

export class RejectionDto {
  @ApiProperty({ format: 'uuid' })
  beneficiaryId!: string;
  @ApiProperty({ example: 'Cohort is at capacity' })
  reason!: string;
}

export class EnrolResultDto {
  @ApiProperty({ type: [String] })
  enrolled!: string[];
  @ApiProperty({ type: [String] })
  alreadyEnrolled!: string[];
  @ApiProperty({ type: [RejectionDto] })
  rejected!: RejectionDto[];
}

export class CompletionsResultDto {
  @ApiProperty()
  saved!: number;
  @ApiProperty({ type: [RejectionDto] })
  rejected!: RejectionDto[];
}
