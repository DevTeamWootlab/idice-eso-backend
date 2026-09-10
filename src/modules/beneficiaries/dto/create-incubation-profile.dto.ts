import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsString,
  IsBoolean,
  IsOptional,
  IsArray,
  IsNotEmpty,
} from 'class-validator';
import { IncubationStage } from '@/common/enums/beneficiary.enum';

export class CreateIncubationProfileDto {
  @ApiPropertyOptional({ example: 'AgroConnect' })
  @IsOptional()
  @IsString()
  ventureName?: string;

  @ApiProperty({ example: 'AGRITECH' })
  @IsString()
  @IsNotEmpty()
  sectorFocus!: string;

  @ApiProperty({ example: 'Smallholder farmers lack direct market access.' })
  @IsString()
  @IsNotEmpty()
  problemStatement!: string;

  @ApiProperty({
    example: 'A mobile marketplace connecting farmers directly to wholesalers.',
  })
  @IsString()
  @IsNotEmpty()
  proposedSolution!: string;

  @ApiProperty({
    example: 'Grain and vegetable wholesalers in North-Central Nigeria.',
  })
  @IsString()
  @IsNotEmpty()
  targetCustomer!: string;

  @ApiProperty({
    enum: IncubationStage,
    example: IncubationStage.EARLY_PROTOTYPE,
  })
  @IsEnum(IncubationStage)
  @IsNotEmpty()
  currentStage!: IncubationStage;

  @ApiProperty({ example: '3 members: 1 CEO, 1 Tech Lead, 1 Operations' })
  @IsString()
  @IsNotEmpty()
  teamSizeAndRoles!: string;

  @ApiPropertyOptional({ example: 'USSD and Web Dashboard' })
  @IsOptional()
  @IsString()
  technologyPlatform?: string;

  @ApiPropertyOptional({
    example: ['MENTORSHIP', 'PRODUCT_DESIGN', 'LEGAL_ADVICE'],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  supportNeeded?: string[];

  @ApiProperty({ example: true })
  @IsBoolean()
  availableForFullDuration!: boolean;
}
