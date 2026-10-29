import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsString,
  IsBoolean,
  IsOptional,
  IsUrl,
  IsNotEmpty,
  IsIn,
  IsInt,
  Min,
  Max,
  IsArray,
  ArrayMaxSize,
  ArrayUnique,
  MaxLength,
} from 'class-validator';
import {
  TrainingTier,
  PreferredHubType,
  SkillFocusArea,
  ExperienceLevel,
  PracticalApplication,
  ProjectIndependence,
  DeliveryFormat,
} from '@/common/enums/beneficiary.enum';
import { EDUCATION_LEVELS, PRD_COURSES_BY_TIER } from '../skill-preference';

export class CreateSkillsProfileDto {
  @ApiProperty({ enum: PreferredHubType, example: PreferredHubType.STANDARD })
  @IsEnum(PreferredHubType)
  @IsNotEmpty()
  preferredHubType!: PreferredHubType;

  @ApiProperty({ enum: TrainingTier, example: TrainingTier.FOUNDATIONAL })
  @IsEnum(TrainingTier)
  @IsNotEmpty()
  skillTier!: TrainingTier;

  @ApiProperty({
    enum: Object.values(PRD_COURSES_BY_TIER).flat(),
    example: 'UI/UX Design',
    description: 'A course from the PRD 7.4 catalogue for the chosen skillTier.',
  })
  @IsString()
  @IsNotEmpty()
  specificSkillArea!: string;

  @ApiPropertyOptional({ example: 'Built basic static sites using HTML/CSS.' })
  @IsOptional()
  @IsString()
  priorExperience?: string;

  @ApiProperty({ enum: EDUCATION_LEVELS, example: 'BSc/BA' })
  @IsIn(EDUCATION_LEVELS)
  highestEducationLevel!: string;

  @ApiProperty({ example: true })
  @IsBoolean()
  ownsPersonalDevice!: boolean;

  @ApiProperty({ example: true })
  @IsBoolean()
  hasReliableInternet!: boolean;

  @ApiPropertyOptional({ example: 'https://github.com/johndoe' })
  @IsOptional()
  @IsUrl()
  portfolioLink?: string;

  @ApiPropertyOptional({ enum: SkillFocusArea, example: SkillFocusArea.DIGITAL })
  @IsOptional()
  @IsEnum(SkillFocusArea)
  focusArea?: SkillFocusArea;

  @ApiPropertyOptional({ example: 'Content Creation', description: 'Retained for older records; not asked on the PRD form.' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  preferredSkill?: string;

  @ApiPropertyOptional({ enum: ExperienceLevel, example: ExperienceLevel.BEGINNER })
  @IsOptional()
  @IsEnum(ExperienceLevel)
  experienceLevel?: ExperienceLevel;

  @ApiPropertyOptional({ example: 2, minimum: 1, maximum: 5, description: 'Self-graded knowledge, 1 (beginner) to 5 (advanced)' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  knowledgeRating?: number;

  @ApiPropertyOptional({ type: [String], example: ['Digital Literacy & Workplace Productivity'] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @ArrayUnique()
  @IsString({ each: true })
  coursesTaken?: string[];

  @ApiPropertyOptional({ example: 3, minimum: 1, maximum: 5, description: 'Confidence with the tools, 1 (none) to 5 (extremely confident)' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  confidenceRating?: number;

  @ApiPropertyOptional({ enum: PracticalApplication, example: PracticalApplication.BASIC })
  @IsOptional()
  @IsEnum(PracticalApplication)
  practicalApplication?: PracticalApplication;

  @ApiPropertyOptional({ enum: ProjectIndependence, example: ProjectIndependence.SEMI })
  @IsOptional()
  @IsEnum(ProjectIndependence)
  independence?: ProjectIndependence;

  @ApiPropertyOptional({ enum: DeliveryFormat, example: DeliveryFormat.HYBRID })
  @IsOptional()
  @IsEnum(DeliveryFormat)
  deliveryFormat?: DeliveryFormat;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  hasSmartphone?: boolean;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  hasBackupPower?: boolean;
}
