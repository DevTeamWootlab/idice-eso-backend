import {
  IsArray,
  IsBoolean,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class ChecklistItemDto {
  @ApiProperty({ example: 'location_confirmed' })
  @IsString() key!: string;

  @ApiProperty({ example: 'Physical office location confirmed on-site' })
  @IsString() label!: string;

  @ApiProperty({ example: true })
  @IsBoolean() verified!: boolean;
}

class GeotaggedPhotoDto {
  @ApiProperty({ description: 'Storage key returned by the document upload endpoint' })
  @IsString() storageKey!: string;

  @ApiProperty({ example: 9.0765 })
  @IsNumber() latitude!: number;

  @ApiProperty({ example: 7.3986 })
  @IsNumber() longitude!: number;

  @ApiPropertyOptional({ description: 'ISO 8601 timestamp the photo was taken', example: '2026-09-17T10:15:00.000Z' })
  @IsOptional() @IsISO8601() takenAt?: string;
}

export class SubmitValidationDto {
  @ApiPropertyOptional({ description: 'Free-text site inspection notes' })
  @IsOptional()
  @IsString()
  siteInspectionNotes?: string;

  @ApiPropertyOptional({
    description: 'Structured field-visit checklist (location/staff/operational-activity/etc.)',
    type: [ChecklistItemDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChecklistItemDto)
  checklist?: ChecklistItemDto[];

  @ApiPropertyOptional({ description: 'Geotagged facility photos taken during the site visit', type: [GeotaggedPhotoDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GeotaggedPhotoDto)
  geotaggedPhotos?: GeotaggedPhotoDto[];

  @ApiProperty({ description: 'Whether the physical footprint was verified on-site' })
  @IsBoolean()
  physicalFootprintVerified!: boolean;
}
