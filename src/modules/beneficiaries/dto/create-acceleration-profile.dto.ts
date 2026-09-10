import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNumber,
  IsBoolean,
  IsOptional,
  IsArray,
  IsUrl,
  Min,
  Max,
  IsNotEmpty,
} from 'class-validator';

export class CreateAccelerationProfileDto {
  @ApiProperty({ example: 'PayNexus Logistics Ltd' })
  @IsString()
  @IsNotEmpty()
  registeredBusinessName!: string;

  @ApiProperty({ example: 'RC1234567' })
  @IsString()
  @IsNotEmpty()
  cacRegistrationNumber!: string;

  @ApiProperty({ example: 2022 })
  @IsNumber()
  @Min(1900)
  @Max(new Date().getFullYear())
  yearFounded!: number;

  @ApiProperty({ example: 'LOGISTICS_AND_FINTECH' })
  @IsString()
  @IsNotEmpty()
  sector!: string;

  @ApiPropertyOptional({ example: 12 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  employeeCount?: number;

  @ApiPropertyOptional({ example: 2500000.0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  estimatedMonthlyRevenueNgn?: number;

  @ApiPropertyOptional({
    example: 'Onboarded 120 merchants, processed over 15,000 deliveries.',
  })
  @IsOptional()
  @IsString()
  keyTraction?: string;

  @ApiProperty({ example: false })
  @IsBoolean()
  hasRaisedExternalFunding!: boolean;

  @ApiPropertyOptional({
    example: 'Angel round of 5M NGN from local investor.',
  })
  @IsOptional()
  @IsString()
  fundingSourceDetails?: string;

  @ApiProperty({
    example: 'Scaling last-mile fleet operations to 3 new states.',
  })
  @IsString()
  @IsNotEmpty()
  primaryGrowthChallenge!: string;

  @ApiPropertyOptional({
    example: ['ACCESS_TO_CAPITAL', 'GOVT_RELATIONS'],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  supportNeeded?: string[];

  @ApiPropertyOptional({
    example: 'Expand to Lagos and Kano with 50,000 transactions monthly.',
  })
  @IsOptional()
  @IsString()
  twelveMonthGrowthTarget?: string;

  @ApiPropertyOptional({ example: 'https://payNexus.ng' })
  @IsOptional()
  @IsUrl()
  liveProductUrl?: string;

  @ApiPropertyOptional({ example: 'beneficiaries/pitch-decks/deck-123.pdf' })
  @IsOptional()
  @IsString()
  pitchDeckStorageKey?: string;
}
