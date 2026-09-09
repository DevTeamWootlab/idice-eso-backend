import { IsOptional, IsString } from 'class-validator';
import { MaxWords } from '@/common/validators/max-word.validator';

export class SectionDDto {
  @IsString()
  @MaxWords(500)
  existingInstitutionalRelationships!: string;

  @IsString()
  @MaxWords(500)
  institutionalCoordinationPlan!: string;

  @IsOptional()
  @IsString()
  @MaxWords(500)
  staffFacultyEngagementPlan?: string;

  @IsOptional()
  @IsString()
  @MaxWords(500)
  beneficiaryReferralPlan?: string;
}
