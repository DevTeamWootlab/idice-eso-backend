import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsEmail,
  IsEnum,
  IsBoolean,
  IsOptional,
  IsUUID,
  IsDateString,
  ValidateNested,
  ValidateIf,
  Matches,
  IsNotEmpty,
} from 'class-validator';
import { Type } from 'class-transformer';
import { Pillar, Gender, StateOfNigeria, AcademicStatus } from '@/common/enums/beneficiary.enum';
import { MaxWords } from '@/common/validators/max-word.validator';

import { CreateSkillsProfileDto } from './create-skills-profile.dto';
import { CreateIncubationProfileDto } from './create-incubation-profile.dto';
import { CreateAccelerationProfileDto } from './create-acceleration-profile.dto';

export class CreateBeneficiaryDto {
  // ---- Section A: Demographics & Bio ----
  @ApiProperty({ example: 'Ayo Chukwuma Abubakar' })
  @IsString()
  @IsNotEmpty()
  fullName!: string;

  @ApiProperty({ example: '2000-05-15' })
  @IsDateString()
  
  dateOfBirth!: string;

  @ApiProperty({ enum: Gender, example: Gender.MALE })
  @IsEnum(Gender)
  gender!: Gender;

  @ApiProperty({ example: '+2348012345678' })
  @Matches(/^\+234\d{10}$/, {
    message:
      'phoneNumber must be a valid Nigerian number in format +234XXXXXXXXXX',
  })
  phoneNumber!: string;

  @ApiProperty({ example: 'john.doe@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: '12345678901' })
  @Matches(/^\d{11}$/, { message: 'nin must be exactly 11 digits' })
  nin!: string;

  @ApiPropertyOptional({ example: 'Wheelchair access required' })
  @IsOptional()
  @IsString()
  pwdAssistiveRequirement?: string;

  @ApiProperty({ example: false })
  @IsBoolean()
  isNeet!: boolean;

  @ApiProperty({ example: true })
  @IsBoolean()
  isCurrentStudent!: boolean;

  @ApiPropertyOptional({ example: 'University of Abuja' })
  @ValidateIf((o) => o.isCurrentStudent === true)
  @IsString()
  @IsNotEmpty({
    message: 'institutionName is required when isCurrentStudent is true',
  })
  institutionName?: string;

  @ApiPropertyOptional({ example: 'UNIABJ/2021/1042' })
  @ValidateIf((o) => o.isCurrentStudent === true)
  @IsString()
  @IsNotEmpty({
    message: 'studentMatricNumber is required when isCurrentStudent is true',
  })
  studentMatricNumber?: string;

  @ApiProperty({ example: false })
  @IsBoolean()
  isRecentGraduate!: boolean;

  @ApiProperty({
    enum: AcademicStatus,
    example: AcademicStatus.RECENT_GRADUATE,
    description: 'Academic / employment status — compulsory. Must agree with isCurrentStudent, isRecentGraduate and isNeet (OTHER = none of them).',
  })
  @IsEnum(AcademicStatus)
  academicStatus!: AcademicStatus;

  @ApiPropertyOptional({ example: 'Mary Doe' })
  @IsOptional()
  @IsString()
  emergencyContactName?: string;

  @ApiPropertyOptional({ example: 'Mother' })
  @IsOptional()
  @IsString()
  emergencyContactRelationship?: string;

  @ApiPropertyOptional({ example: '+2348098765432' })
  @IsOptional()
  @Matches(/^\+234\d{10}$/, {
    message: 'emergencyContactPhone must be in format +234XXXXXXXXXX',
  })
  emergencyContactPhone?: string;

  @ApiProperty({ enum: StateOfNigeria, example: StateOfNigeria.FCT })
  @IsEnum(StateOfNigeria)
  stateOfOrigin!: StateOfNigeria;

  @ApiProperty({ enum: StateOfNigeria, example: StateOfNigeria.FCT })
  @IsEnum(StateOfNigeria)
  stateOfResidence!: StateOfNigeria;

  @ApiProperty({ example: 'Abuja Municipal' })
  @IsString()
  @IsNotEmpty()
  lga!: string;

  @ApiProperty({ example: 'Plot 42, Garki 2, Abuja' })
  @IsString()
  @IsNotEmpty()
  homeAddress!: string;

  // ---- Program Selection & Allocation ----
  @ApiProperty({ enum: Pillar, example: Pillar.SKILLS })
  @IsEnum(Pillar)
  pillar!: Pillar;

  @ApiProperty({ example: 'aab27252-cbdd-41fc-ac23-53e2b7d29a02' })
  @IsUUID()
  preferredInstitutionId!: string;

  @ApiPropertyOptional({
    example: 'I want to build software solutions to empower rural farmers...',
  })
  @IsOptional()
  @IsString()
  @MaxWords(150, { message: 'statementOfPurpose must not exceed 150 words' })
  statementOfPurpose?: string;

  @ApiProperty({ example: true })
  @IsBoolean()
  ndprConsentGiven!: boolean;

  @ApiProperty({ example: true })
  @IsBoolean()
  codeOfConductAccepted!: boolean;

  // ---- Dynamic Pillar Profile Payload ----
  @ApiPropertyOptional({ type: CreateSkillsProfileDto })
  @ValidateIf((o) => o.pillar === Pillar.SKILLS)
  @ValidateNested()
  @Type(() => CreateSkillsProfileDto)
  skillsProfile?: CreateSkillsProfileDto;

  @ApiPropertyOptional({ type: CreateIncubationProfileDto })
  @ValidateIf((o) => o.pillar === Pillar.INCUBATION)
  @ValidateNested()
  @Type(() => CreateIncubationProfileDto)
  incubationProfile?: CreateIncubationProfileDto;

  @ApiPropertyOptional({ type: CreateAccelerationProfileDto })
  @ValidateIf((o) => o.pillar === Pillar.ACCELERATION)
  @ValidateNested()
  @Type(() => CreateAccelerationProfileDto)
  accelerationProfile?: CreateAccelerationProfileDto;
}
