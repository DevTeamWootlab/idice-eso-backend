import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { BeneficiaryStatus, Pillar } from '@/common/enums/beneficiary.enum';

const blankToUndefined = ({ value }: { value: unknown }) =>
  typeof value === 'string' && value.trim() === '' ? undefined : value;

export class ListBeneficiariesDto {
  @ApiPropertyOptional({ description: 'Matches name, email or reference ID' })
  @IsOptional()
  @Transform(blankToUndefined)
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({ enum: BeneficiaryStatus })
  @IsOptional()
  @Transform(blankToUndefined)
  @IsEnum(BeneficiaryStatus)
  status?: BeneficiaryStatus;

  @ApiPropertyOptional({ enum: Pillar })
  @IsOptional()
  @Transform(blankToUndefined)
  @IsEnum(Pillar)
  pillar?: Pillar;

  @ApiPropertyOptional({ description: 'Assigned institution (CoE) ID' })
  @IsOptional()
  @Transform(blankToUndefined)
  @IsUUID()
  institutionId?: string;

  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
