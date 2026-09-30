import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags, ApiOkResponse } from '@nestjs/swagger';
import { Roles } from '@/common/decorators/roles.decorator';
import { Role } from '@/common/enums/role.enum';
import { BeneficiariesService } from './beneficiaries.service';
import { ListBeneficiariesDto } from './dto/list-beneficiaries.dto';
import { UpdateBeneficiaryStatusDto } from './dto/update-beneficiary-status.dto';
import { BulkUpdateBeneficiaryStatusDto } from './dto/bulk-update-beneficiary-status.dto';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { JwtPayload } from '@/common/interfaces/jwt-payload.interface';
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
    summary: 'Change the status of many beneficiaries at once',
    description:
      'Requires role: ROLE_SYSADMIN. Applies the same rules as the single update to each beneficiary in turn ' +
      '(allowed transitions, CoE capacity). Returns which succeeded and why any failed. Up to 200 per request.',
  })
  @Post('bulk-status')
  bulkUpdateStatus(@Body() dto: BulkUpdateBeneficiaryStatusDto, @CurrentUser() user: JwtPayload) {
    return this.beneficiariesService.bulkUpdateStatusForAdmin(dto, user);
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
