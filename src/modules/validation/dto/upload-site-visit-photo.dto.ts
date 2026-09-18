import { IsNumber, Max, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UploadSiteVisitPhotoDto {
  @ApiProperty({ example: 9.0765, description: 'Latitude captured on-device at the time of the photo' })
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude!: number;

  @ApiProperty({ example: 7.3986, description: 'Longitude captured on-device at the time of the photo' })
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude!: number;
}
