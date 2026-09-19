import { ApiProperty } from '@nestjs/swagger';
import { TrainingTier } from '@/common/enums/beneficiary.enum';

class YouthEnrolledDto {
  @ApiProperty({ description: 'Beneficiaries with status ALLOCATED', example: 1240 })
  value!: number;
  @ApiProperty({ example: 25000 })
  target!: number;
}

class FemaleParticipationDto {
  @ApiProperty({ example: 480 })
  participants!: number;
  @ApiProperty({ type: Number, nullable: true, description: 'null while nobody is enrolled', example: 38.7 })
  percent!: number | null;
  @ApiProperty({ example: 40 })
  target!: number;
}

class StartupsIncubatedDto {
  @ApiProperty({ description: 'Enrolled beneficiaries in the INCUBATION pillar' })
  value!: number;
  @ApiProperty({ example: 600 })
  targetPerCoe!: number;
  @ApiProperty({ description: 'Active Centres of Excellence' })
  coeCount!: number;
}

class JobPlacementDto {
  @ApiProperty({ description: 'Graduates with a verified employment outcome' })
  placed!: number;
  @ApiProperty({ description: 'Beneficiaries who completed at least one course' })
  completers!: number;
  @ApiProperty({ type: Number, nullable: true, description: 'null until someone has completed training' })
  percent!: number | null;
  @ApiProperty({ example: 80 })
  target!: number;
}

class NeetPwdInclusionDto {
  @ApiProperty()
  participants!: number;
  @ApiProperty({ type: Number, nullable: true })
  percent!: number | null;
}

class SkillTierProgressDto {
  @ApiProperty({ enum: TrainingTier })
  tier!: TrainingTier;
  @ApiProperty({ description: 'Distinct trainees with a completed cohort in a course of this tier' })
  completed!: number;
  @ApiProperty()
  target!: number;
}

class PerCoeDto {
  @ApiProperty({ format: 'uuid' })
  institutionId!: string;
  @ApiProperty()
  name!: string;
  @ApiProperty()
  state!: string;
  @ApiProperty()
  youthEnrolled!: number;
  @ApiProperty()
  startupsIncubated!: number;
}

export class PcuMetricsDto {
  @ApiProperty({ format: 'date-time' })
  generatedAt!: string;
  @ApiProperty({ type: YouthEnrolledDto })
  youthEnrolled!: YouthEnrolledDto;
  @ApiProperty({ type: FemaleParticipationDto })
  femaleParticipation!: FemaleParticipationDto;
  @ApiProperty({ type: StartupsIncubatedDto })
  startupsIncubated!: StartupsIncubatedDto;
  @ApiProperty({ type: JobPlacementDto })
  jobPlacement!: JobPlacementDto;
  @ApiProperty({ type: NeetPwdInclusionDto })
  neetPwdInclusion!: NeetPwdInclusionDto;
  @ApiProperty({ type: [SkillTierProgressDto] })
  skillTiers!: SkillTierProgressDto[];
  @ApiProperty({ type: [PerCoeDto] })
  perCoe!: PerCoeDto[];
}
