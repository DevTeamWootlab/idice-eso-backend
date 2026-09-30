import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayMinSize, ArrayUnique, IsArray, IsEnum, IsOptional, IsUUID } from 'class-validator';
import { BeneficiaryStatus } from '@/common/enums/beneficiary.enum';
import { ADMIN_SETTABLE_BENEFICIARY_STATUSES } from '../beneficiary-lifecycle';

export const BULK_BENEFICIARY_LIMIT = 200;

export class BulkUpdateBeneficiaryStatusDto {
  @ApiProperty({ type: [String], maxItems: BULK_BENEFICIARY_LIMIT })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(BULK_BENEFICIARY_LIMIT)
  @ArrayUnique()
  @IsUUID('all', { each: true })
  ids!: string[];

  @ApiProperty({ enum: ADMIN_SETTABLE_BENEFICIARY_STATUSES })
  @IsEnum(BeneficiaryStatus)
  status!: BeneficiaryStatus;

  @ApiPropertyOptional({
    description: 'Only when allocating: the CoE to enrol every selected beneficiary at. Defaults to each one\'s intake hub.',
  })
  @IsOptional()
  @IsUUID()
  institutionId?: string;
}
