// modules/eligibility/eligibility.controller.ts
import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { EligibilityService } from './eligibility.service';
import { SubmitEligibilityReviewDto } from './dto/submit-eligibility-review.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Role } from '../../common/enums/role.enum';
import { JwtPayload } from '../../common/interfaces/jwt-payload.interface';

@Controller('internal/applications')
@Roles(Role.ELIGIBILITY_REVIEWER)
export class EligibilityController {
  constructor(private readonly eligibilityService: EligibilityService) {}

  @Get('queue/eligibility')
  getQueue() {
    return this.eligibilityService.getQueue();
  }

  @Get(':id/eligibility')
  getDossier(@Param('id', ParseUUIDPipe) id: string) {
    return this.eligibilityService.getDossier(id);
  }

  @Post(':id/eligibility/review')
  submitReview(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SubmitEligibilityReviewDto,
  ) {
    return this.eligibilityService.submitReview(id, user.sub, dto);
  }

  @Post(':id/eligibility/rework')
  requestRework(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body('notes') notes: string,
  ) {
    return this.eligibilityService.requestRework(id, user.sub, notes);
  }
}
