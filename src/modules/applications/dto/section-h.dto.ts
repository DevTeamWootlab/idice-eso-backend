import { IsBoolean, IsString, Equals } from 'class-validator';

export class SectionHDto {
  @IsBoolean()
  @Equals(true, {
    message: 'You must consent to NDPA 2023 data protection terms',
  })
  ndpaComplianceAccepted!: boolean;

  @IsBoolean()
  @Equals(true, { message: 'You must confirm the declaration of accuracy' })
  declarationOfAccuracyConfirmed!: boolean;

  @IsBoolean()
  @Equals(true, {
    message: 'You must accept the brownfield rehabilitation restriction',
  })
  brownfieldRestrictionAccepted!: boolean;

  @IsString()
  authorisedSignatoryName!: string;

  @IsString()
  authorisedSignatoryTitle!: string;
}
