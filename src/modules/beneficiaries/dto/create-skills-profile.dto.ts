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
import { PREFERRED_SKILLS, PRIOR_COURSES } from '../skill-preference';

export class CreateSkillsProfileDto {
  @ApiProperty({ enum: PreferredHubType, example: PreferredHubType.STANDARD })
  @IsEnum(PreferredHubType)
  @IsNotEmpty()
  preferredHubType!: PreferredHubType;

  @ApiProperty({ enum: TrainingTier, example: TrainingTier.FOUNDATIONAL })
  @IsEnum(TrainingTier)
  @IsNotEmpty()
  skillTier!: TrainingTier;

  @ApiProperty({ example: 'Fullstack Web Development (Node.js/React)' })
  @IsString()
  @IsNotEmpty()
  specificSkillArea!: string;

  @ApiPropertyOptional({ example: 'Built basic static sites using HTML/CSS.' })
  @IsOptional()
  @IsString()
  priorExperience?: string;

  @ApiPropertyOptional({
    example: 'BSc/BA',
    description: 'Deprecated here; send highestEducationLevel at the top level. Ignored when the top-level value is present.',
  })
  @IsOptional()
  @IsString()
  highestEducationLevel?: string;

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

  @ApiPropertyOptional({
    enum: PREFERRED_SKILLS,
    example: 'Cybersecurity',
    description:
      'Must belong to focusArea. Virtual Reality Skills is only accepted at a VR hub and Game Hub Skills only at a gaming hub.',
  })
  @IsOptional()
  @IsIn(PREFERRED_SKILLS)
  preferredSkill?: string;

  @ApiProperty({ enum: ExperienceLevel, example: ExperienceLevel.BEGINNER })
  @IsEnum(ExperienceLevel)
  experienceLevel!: ExperienceLevel;

  @ApiProperty({ example: 2, minimum: 1, maximum: 5, description: 'Self-graded knowledge, 1 (beginner) to 5 (advanced)' })
  @IsInt()
  @Min(1)
  @Max(5)
  knowledgeRating!: number;

  @ApiPropertyOptional({ type: [String], enum: PRIOR_COURSES, example: ['Data and AI Fundamentals (Beginner)'] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(PRIOR_COURSES.length)
  @ArrayUnique()
  @IsIn(PRIOR_COURSES, { each: true })
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
