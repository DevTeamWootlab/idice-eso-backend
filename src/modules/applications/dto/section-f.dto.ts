import { IsBoolean, IsString } from 'class-validator';
import { MaxWords } from '@/common/validators/max-word.validator';

export class SectionFDto {
  @IsBoolean()
  hasConductedIncubation!: boolean;

  @IsBoolean()
  hasConductedAcceleration!: boolean;

  @IsString()
  @MaxWords(500)
  monitoringReportingSystems!: string;

  @IsString()
  @MaxWords(500)
  sustainabilityPlan!: string;

  @IsString()
  @MaxWords(500)
  employmentPathway!: string;
}
