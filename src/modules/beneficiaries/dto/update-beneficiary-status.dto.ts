import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { BeneficiaryStatus } from '@/common/enums/beneficiary.enum';
import { ADMIN_SETTABLE_BENEFICIARY_STATUSES } from '../beneficiary-lifecycle';

export class UpdateBeneficiaryStatusDto {
  @ApiProperty({ enum: ADMIN_SETTABLE_BENEFICIARY_STATUSES })
  @IsEnum(BeneficiaryStatus)
  status!: BeneficiaryStatus;

  @ApiPropertyOptional({
    description:
      'Only when allocating: the CoE to enrol the beneficiary at. Defaults to the hub assigned at intake.',
  })
  @IsOptional()
  @IsUUID()
  institutionId?: string;
}
