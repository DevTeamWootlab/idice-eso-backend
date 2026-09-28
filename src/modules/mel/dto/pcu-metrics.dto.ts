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
  @ApiProperty()
  enterprisesAccelerated!: number;
}

class PillarCountsDto {
  @ApiProperty({ description: 'Enrolled youth in Digital and Creative Talent Development (SKILLS)' })
  skills!: number;
  @ApiProperty({ description: 'Enrolled beneficiaries in Startup Incubation' })
  incubation!: number;
  @ApiProperty({ description: 'Enrolled beneficiaries in Enterprise Acceleration' })
  acceleration!: number;
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
  @ApiProperty({ type: PillarCountsDto })
  pillars!: PillarCountsDto;
  @ApiProperty({ type: JobPlacementDto })
  jobPlacement!: JobPlacementDto;
  @ApiProperty({ type: NeetPwdInclusionDto })
  neetPwdInclusion!: NeetPwdInclusionDto;
  @ApiProperty({ type: [SkillTierProgressDto] })
  skillTiers!: SkillTierProgressDto[];
  @ApiProperty({ type: [PerCoeDto] })
  perCoe!: PerCoeDto[];
}

class CoeIdentityDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;
  @ApiProperty()
  name!: string;
  @ApiProperty()
  state!: string;
  @ApiProperty({ enum: ['STANDARD', 'GAMING', 'VR', 'CREATIVE'] })
  hubType!: string;
  @ApiProperty()
  beneficiaryCapacity!: number;
  @ApiProperty({ enum: ['NUC', 'NBTE', 'OTHER'] })
  regulator!: string;
  @ApiProperty()
  isActive!: boolean;
}

class BreakdownItemDto {
  @ApiProperty({ description: 'Pillar or gender value' })
  key!: string;
  @ApiProperty()
  count!: number;
}

class CoeCohortDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;
  @ApiProperty()
  name!: string;
  @ApiProperty({ type: String, nullable: true })
  courseTitle!: string | null;
  @ApiProperty({ type: String, nullable: true })
  tier!: string | null;
  @ApiProperty()
  status!: string;
  @ApiProperty({ example: '2026-10-05' })
  startDate!: string;
  @ApiProperty({ type: String, nullable: true })
  endDate!: string | null;
  @ApiProperty({ description: '0 means no cap' })
  capacity!: number;
  @ApiProperty()
  members!: number;
  @ApiProperty()
  completed!: number;
}

export class PcuCoeDetailDto {
  @ApiProperty({ type: CoeIdentityDto })
  institution!: CoeIdentityDto;
  @ApiProperty({ type: PcuMetricsDto, description: 'The same KPIs, restricted to this Centre of Excellence' })
  metrics!: PcuMetricsDto;
  @ApiProperty({ type: Number, nullable: true, description: 'Youth enrolled as a share of the CoE capacity' })
  capacityUtilisationPercent!: number | null;
  @ApiProperty({ type: [BreakdownItemDto] })
  pillars!: BreakdownItemDto[];
  @ApiProperty({ type: [BreakdownItemDto] })
  genders!: BreakdownItemDto[];
  @ApiProperty({ type: [CoeCohortDto] })
  cohorts!: CoeCohortDto[];
}
