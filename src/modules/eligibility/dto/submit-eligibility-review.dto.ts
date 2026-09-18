import {
  IsArray,
  ValidateNested,
  IsEnum,
  IsBoolean,
  IsOptional,
  IsString,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EligibilityCheckCode } from '../entities/eligibility-check-item.entity';

class CheckItemInputDto {
  @ApiProperty({ enum: EligibilityCheckCode, example: EligibilityCheckCode.LEGAL_REGISTRATION })
  @IsEnum(EligibilityCheckCode)
  code!: EligibilityCheckCode;

  @ApiProperty({ description: 'Whether this statutory check passed', example: true })
  @IsBoolean()
  passed!: boolean;

  @ApiPropertyOptional({ description: 'Reviewer note for this specific check item' })
  @IsOptional()
  @IsString()
  note?: string;
}

export class SubmitEligibilityReviewDto {
  @ApiProperty({
    description: 'All 12 EligibilityCheckCode items — every code must be present or the request 400s',
    type: [CheckItemInputDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CheckItemInputDto)
  items!: CheckItemInputDto[];

  @ApiPropertyOptional({
    description: 'Mandatory when any item in `items` has passed:false',
    example: 'Tax clearance certificate expired; audited accounts not provided.',
  })
  @IsOptional()
  @IsString()
  rejectionRemarks?: string; // mandatory if any item fails — enforced in service
}
