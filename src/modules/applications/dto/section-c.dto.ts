import { IsArray, IsEnum, IsString, ArrayMinSize } from 'class-validator';
import { SectorFocus } from '@/common/enums/application.enum';
import { MaxWords } from '@/common/validators/max-word.validator';

export class SectionCDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsEnum(SectorFocus, { each: true })
  sectorFocus!: SectorFocus[];

  @IsString()
  @MaxWords(500)
  programmeDeliveryTrackRecord!: string;

  @IsString()
  @MaxWords(500)
  mentorshipIndustryNetwork!: string;

  @IsString()
  @MaxWords(500)
  inclusionAccessibilityCapacity!: string;
}
