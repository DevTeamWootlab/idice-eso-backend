import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsString,
  IsBoolean,
  IsOptional,
  IsUrl,
  IsNotEmpty,
} from 'class-validator';
import {
  TrainingTier,
  PreferredHubType,
} from '@/common/enums/beneficiary.enum';

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
}
