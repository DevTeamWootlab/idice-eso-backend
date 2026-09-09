import {
  IsArray,
  IsEnum,
  IsString,
  IsOptional,
  ArrayMinSize,
  IsDateString,
} from 'class-validator';
import {
  OperatingState,
  ProximityToHost,
} from '@/common/enums/application.enum';

export class SectionBDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsEnum(OperatingState, { each: true })
  statesOfOperation!: OperatingState[];

  @IsString()
  physicalAddress!: string;

  @IsEnum(ProximityToHost)
  proximityToHostInstitution!: ProximityToHost;

  @IsString()
  tin!: string;

  @IsOptional()
  @IsString()
  staffingSummary?: string;

  @IsOptional()
  @IsDateString()
  taxClearanceExpiry?: string;

  @IsOptional()
  @IsString()
  taxClearanceCertificateUrl?: string;

  @IsOptional()
  @IsString()
  taxComplianceEvidenceUrl?: string;

  @IsOptional()
  @IsString()
  auditedAccountsUrl?: string;

  @IsOptional()
  @IsString()
  organogramUrl?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  personnelCvUrls?: string[];

  @IsOptional()
  @IsString()
  governanceStructure?: string;
}
