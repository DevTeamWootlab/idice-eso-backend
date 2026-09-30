// modules/applications/admin-applications.controller.ts
import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  ParseIntPipe,
  Post,
  Query,
  Res,
  StreamableFile,
} from '@nestjs/common';
import type { Response } from 'express';
import { contentDisposition } from '@/common/utils/content-disposition';
import { ApiBearerAuth, ApiOperation, ApiTags, ApiOkResponse, ApiCreatedResponse } from '@nestjs/swagger';
import { ApplicationsService } from './applications.service';
import { AssignReviewersDto } from './dto/assign-reviewers.dto';
import { ReassignReviewerDto } from './dto/reassign-reviewer.dto';
import { ListAdminApplicationsDto } from './dto/list-admin-applications.dto';
import { ExportAdminApplicationsDto } from './dto/export-admin-applications.dto';
import { Roles } from '@/common/decorators/roles.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Role } from '@/common/enums/role.enum';
import { JwtPayload } from '@/common/interfaces/jwt-payload.interface';
import { AdminApplicationStatsDto, AdminApplicationListDto } from './dto/applicant-views.dto';

@ApiTags('Applications (SYSADMIN)')
@ApiBearerAuth()
@Controller('internal/admin/applications')
@Roles(Role.SYSADMIN)
export class AdminApplicationsController {
  constructor(private readonly applicationsService: ApplicationsService) {}

  // Static routes ('' and 'stats') must stay above ':id' — otherwise 'stats' is captured
  // by ParseUUIDPipe on the :id route and rejected with a 400.
  @ApiOperation({
    summary: 'List applications',
    description:
      'Requires role: ROLE_SYSADMIN. Paginated, with optional search (organisation name or ' +
      'application code), status filter (one or comma-separated) and state filter. DRAFT ' +
      'applications are excluded unless requested via status=DRAFT.',
  })
  @ApiOkResponse({ type: AdminApplicationListDto })
  @Get()
  list(@Query() query: ListAdminApplicationsDto) {
    return this.applicationsService.listForAdmin(query);
  }

  @ApiOperation({
    summary: 'Application counts by status',
    description:
      'Requires role: ROLE_SYSADMIN. Zero-filled per-status counts plus a total that excludes DRAFT.',
  })
  @ApiOkResponse({ type: AdminApplicationStatsDto })
  @Get('stats')
  stats() {
    return this.applicationsService.getAdminStats();
  }

  @ApiOkResponse({ description: 'Per-reviewer workload and output for scoring, eligibility and validation' })
  @ApiOperation({ summary: 'Reviewer activity statistics', description: 'Requires role: ROLE_SYSADMIN' })
  @Get('reviewer-activity')
  reviewerActivity() {
    return this.applicationsService.getReviewerActivity();
  }

  @ApiOkResponse({ description: 'Applications as a CSV, Excel or PDF file' })
  @ApiOperation({
    summary: 'Export applications',
    description:
      'Requires role: ROLE_SYSADMIN. Same filters as the list (search, statuses, state). format=csv|xlsx|pdf. ' +
      'Responds with the file itself, not the usual JSON envelope.',
  })
  @Get('export')
  async export(@Query() query: ExportAdminApplicationsDto, @Res({ passthrough: true }) res: Response) {
    const file = await this.applicationsService.exportApplications(query);
    res.set({
      'Content-Type': file.contentType,
      'Content-Disposition': contentDisposition(file.fileName, 'attachment'),
      'Cache-Control': 'private, no-store',
    });
    return new StreamableFile(file.buffer);
  }

  @ApiOkResponse({ description: 'Full application: all sections, documents, personnel, references and score cards' })
  @ApiOperation({ summary: 'Get an application\'s full details', description: 'Requires role: ROLE_SYSADMIN' })
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.applicationsService.findOneForAdmin(id);
  }

  @ApiOkResponse({ description: 'The latest field-validation record: notes, checklist, footprint check and photo list' })
  @ApiOperation({ summary: 'Get an application\'s field-validation evidence', description: 'Requires role: ROLE_SYSADMIN' })
  @Get(':id/validation-record')
  validationRecord(@Param('id', ParseUUIDPipe) id: string) {
    return this.applicationsService.getValidationRecordForAdmin(id);
  }

  @ApiOkResponse({ description: 'The photo file itself' })
  @ApiOperation({ summary: 'Download one field-validation photo', description: 'Requires role: ROLE_SYSADMIN' })
  @Get(':id/validation-record/photos/:index')
  async validationPhoto(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('index', ParseIntPipe) index: number,
    @Res({ passthrough: true }) res: Response,
  ) {
    const photo = await this.applicationsService.getValidationPhotoForAdmin(id, index);
    res.set({
      'Content-Type': photo.contentType,
      'Content-Disposition': contentDisposition(photo.fileName),
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'private, no-store',
    });
    return new StreamableFile(photo.buffer);
  }

  @ApiOkResponse({ description: 'Reviewer assignments for the application' })
  @ApiOperation({ summary: 'List reviewer assignments for an application', description: 'Requires role: ROLE_SYSADMIN' })
  @Get(':id/reviewer-assignments')
  listAssignments(@Param('id', ParseUUIDPipe) id: string) {
    return this.applicationsService.listReviewerAssignments(id);
  }

  @ApiCreatedResponse({ description: 'The two created scoring-reviewer assignments' })
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

  @ApiCreatedResponse({ description: 'The updated reviewer assignment' })
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
