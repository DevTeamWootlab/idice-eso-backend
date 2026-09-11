import {
  IsArray,
  ValidateNested,
  IsEnum,
  IsBoolean,
  IsOptional,
  IsString,
} from 'class-validator';
import { Type } from 'class-transformer';
import { EligibilityCheckCode } from '../entities/eligibility-check-item.entity';

class CheckItemInputDto {
  @IsEnum(EligibilityCheckCode)
  code!: EligibilityCheckCode;

  @IsBoolean()
  passed!: boolean;

  @IsOptional()
  @IsString()
  note?: string;
}

export class SubmitEligibilityReviewDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CheckItemInputDto)
  items!: CheckItemInputDto[];

  @IsOptional()
  @IsString()
  rejectionRemarks?: string; // mandatory if any item fails — enforced in service
}
