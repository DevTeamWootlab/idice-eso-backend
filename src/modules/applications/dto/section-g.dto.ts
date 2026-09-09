import { IsBoolean } from 'class-validator';

export class SectionGDto {
  @IsBoolean()
  conflictOfInterestDeclared!: boolean;

  @IsBoolean()
  safeguardingPolicyCommitted!: boolean;

  @IsBoolean()
  genderInclusionPolicyCommitted!: boolean;

  @IsBoolean()
  idiceReportingQaCommitted!: boolean;
}
