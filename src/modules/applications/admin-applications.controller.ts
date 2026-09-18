// modules/applications/admin-applications.controller.ts
import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApplicationsService } from './applications.service';
import { AssignReviewersDto } from './dto/assign-reviewers.dto';
import { ReassignReviewerDto } from './dto/reassign-reviewer.dto';
import { Roles } from '@/common/decorators/roles.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Role } from '@/common/enums/role.enum';
import { JwtPayload } from '@/common/interfaces/jwt-payload.interface';

@ApiTags('Applications (SYSADMIN)')
@ApiBearerAuth()
@Controller('internal/admin/applications')
@Roles(Role.SYSADMIN)
export class AdminApplicationsController {
  constructor(private readonly applicationsService: ApplicationsService) {}

  @ApiOperation({ summary: 'Get an application\'s full details', description: 'Requires role: ROLE_SYSADMIN' })
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.applicationsService.findOneForAdmin(id);
  }

  @ApiOperation({ summary: 'List reviewer assignments for an application', description: 'Requires role: ROLE_SYSADMIN' })
  @Get(':id/reviewer-assignments')
  listAssignments(@Param('id', ParseUUIDPipe) id: string) {
    return this.applicationsService.listReviewerAssignments(id);
  }

  @ApiOperation({ summary: 'Assign the two blind scoring reviewers', description: 'Requires role: ROLE_SYSADMIN' })
  @Post(':id/assign-scoring-reviewers')
  assignReviewers(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignReviewersDto,
  ) {
    return this.applicationsService.assignScoringReviewers(
      id,
      dto.reviewerIds,
      user.sub,
    );
  }

  @ApiOperation({ summary: 'Reassign a scoring reviewer', description: 'Requires role: ROLE_SYSADMIN' })
  @Post(':id/reassign-scoring-reviewer')
  reassignReviewer(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReassignReviewerDto,
  ) {
    return this.applicationsService.reassignScoringReviewer(
      id,
      dto.outgoingReviewerId,
      dto.incomingReviewerId,
      user.sub,
    );
  }
}
