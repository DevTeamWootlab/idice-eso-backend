// modules/eligibility/eligibility.controller.ts
import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { EligibilityService } from './eligibility.service';
import { SubmitEligibilityReviewDto } from './dto/submit-eligibility-review.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Role } from '../../common/enums/role.enum';
import { JwtPayload } from '../../common/interfaces/jwt-payload.interface';

@ApiTags('Eligibility review')
@ApiBearerAuth()
@Controller('internal/applications')
@Roles(Role.ELIGIBILITY_REVIEWER)
export class EligibilityController {
  constructor(private readonly eligibilityService: EligibilityService) {}

  @ApiOperation({ summary: 'Get the eligibility review queue', description: 'Requires role: ROLE_ELIGIBILITY_REVIEWER' })
  @Get('queue/eligibility')
  getQueue() {
    return this.eligibilityService.getQueue();
  }

  @ApiOperation({
    summary: 'Get an application dossier for eligibility review',
    description:
      'Requires role: ROLE_ELIGIBILITY_REVIEWER. Narrative/qualitative fields are stripped ' +
      'server-side (cognitive bias masking) — this is intended, not an error.',
  })
  @Get(':id/eligibility')
  getDossier(@Param('id', ParseUUIDPipe) id: string) {
    return this.eligibilityService.getDossier(id);
  }

  @ApiOperation({
    summary: 'Submit an eligibility review decision',
    description:
      'Requires role: ROLE_ELIGIBILITY_REVIEWER. All 12 EligibilityCheckCode items must be ' +
      'present or the request 400s; rejectionRemarks is mandatory if any item fails.',
  })
  @Post(':id/eligibility/review')
  submitReview(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SubmitEligibilityReviewDto,
  ) {
    return this.eligibilityService.submitReview(id, user.sub, dto);
  }

  @ApiOperation({
    summary: 'Send the application back to the applicant for rework',
    description: 'Requires role: ROLE_ELIGIBILITY_REVIEWER',
  })
  @Post(':id/eligibility/rework')
  requestRework(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body('notes') notes: string,
  ) {
    return this.eligibilityService.requestRework(id, user.sub, notes);
  }
}
