import {
  IsString,
  IsEnum,
  IsInt,
  IsOptional,
  IsUrl,
  IsEmail,
  Min,
  Max,
} from 'class-validator';
import {
  RegistrationType,
  OrganisationType,
} from '@/common/enums/application.enum';

export class SectionADto {
  @IsString()
  organisationLegalName!: string;

  @IsEnum(RegistrationType)
  registrationType!: RegistrationType;

  @IsInt()
  @Min(1900)
  @Max(new Date().getFullYear())
  yearEstablished!: number;

  @IsEnum(OrganisationType)
  organisationType!: OrganisationType;

  @IsOptional()
  @IsUrl()
  websiteOrSocialHandle?: string;

  @IsString()
  primaryContactName!: string;

  @IsString()
  primaryContactRole!: string;

  @IsString()
  primaryContactPhone!: string;

  @IsEmail()
  primaryContactEmail!: string;
}
