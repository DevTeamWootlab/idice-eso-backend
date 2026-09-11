import {
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class GeotaggedPhotoDto {
  @IsString() storageKey!: string;
  @IsString() latitude!: string;
  @IsString() longitude!: string;
}

export class SubmitValidationDto {
  @IsOptional()
  @IsString()
  siteInspectionNotes?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GeotaggedPhotoDto)
  geotaggedPhotos?: GeotaggedPhotoDto[];

  @IsBoolean()
  physicalFootprintVerified!: boolean;
}
