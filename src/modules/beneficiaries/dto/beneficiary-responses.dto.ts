import { ApiProperty } from '@nestjs/swagger';
import {
  BeneficiaryStatus,
  Gender,
  Pillar,
  StateOfNigeria,
} from '@/common/enums/beneficiary.enum';

export class InstitutionRefDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;
  @ApiProperty()
  name!: string;
  @ApiProperty()
  state!: string;
}

export class BeneficiarySummaryDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;
  @ApiProperty({ example: 'iDICE-BEN-2026-1A2B3C4D' })
  referenceId!: string;
  @ApiProperty()
  fullName!: string;
  @ApiProperty({ enum: Gender })
  gender!: Gender;
  @ApiProperty()
  email!: string;
  @ApiProperty()
  phoneNumber!: string;
  @ApiProperty({ enum: Pillar })
  pillar!: Pillar;
  @ApiProperty({ enum: BeneficiaryStatus })
  status!: BeneficiaryStatus;
  @ApiProperty({ enum: StateOfNigeria })
  stateOfResidence!: StateOfNigeria;
  @ApiProperty({ type: String, nullable: true, format: 'uuid' })
  assignedInstitutionId!: string | null;
  @ApiProperty({ type: InstitutionRefDto, nullable: true })
  assignedInstitution!: InstitutionRefDto | null;
  @ApiProperty({ format: 'date-time' })
  createdAt!: string;
}

export class BeneficiaryListDto {
  @ApiProperty({ type: [BeneficiarySummaryDto] })
  items!: BeneficiarySummaryDto[];
  @ApiProperty()
  total!: number;
  @ApiProperty()
  page!: number;
  @ApiProperty()
  limit!: number;
  @ApiProperty()
  totalPages!: number;
}
