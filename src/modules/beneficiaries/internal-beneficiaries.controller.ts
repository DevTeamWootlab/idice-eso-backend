import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags, ApiOkResponse } from '@nestjs/swagger';
import { Roles } from '@/common/decorators/roles.decorator';
import { Role } from '@/common/enums/role.enum';
import { BeneficiariesService } from './beneficiaries.service';
import { ListBeneficiariesDto } from './dto/list-beneficiaries.dto';
import { UpdateBeneficiaryStatusDto } from './dto/update-beneficiary-status.dto';
import { BeneficiaryListDto, BeneficiarySummaryDto } from './dto/beneficiary-responses.dto';

@ApiTags('Beneficiaries (SYSADMIN)')
@ApiBearerAuth()
@Controller('internal/beneficiaries')
@Roles(Role.SYSADMIN)
export class InternalBeneficiariesController {
  constructor(private readonly beneficiariesService: BeneficiariesService) {}

  @ApiOperation({
    summary: 'List beneficiaries',
    description:
      'Requires role: ROLE_SYSADMIN. Paginated, filterable by status, pillar, CoE and free text. ' +
      'Never returns NIN data.',
  })
  @ApiOkResponse({ type: BeneficiaryListDto })
  @Get()
  list(@Query() query: ListBeneficiariesDto) {
    return this.beneficiariesService.listForAdmin(query);
  }

  @ApiOperation({
    summary: 'Move a beneficiary through review / allocate to a CoE',
    description:
      'Requires role: ROLE_SYSADMIN. Allocating (status=ALLOCATED) enrols the youth at a CoE ' +
      'and is what the PCU dashboard counts as "youth enrolled"; it respects the CoE capacity.',
  })
  @ApiOkResponse({ type: BeneficiarySummaryDto })
  @Patch(':id/status')
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateBeneficiaryStatusDto,
  ) {
    return this.beneficiariesService.updateStatusForAdmin(id, dto);
  }
}
