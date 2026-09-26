import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Res,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { ApiBearerAuth, ApiOperation, ApiTags, ApiOkResponse, ApiCreatedResponse, ApiNoContentResponse } from '@nestjs/swagger';
import { ApplicationsService } from './applications.service';
import { SaveDraftDto } from './dto/save-draft.dto';
import { SubmitApplicationDto } from './dto/submit-application.dto';
import { UploadDocumentDto } from './dto/upload-document.dto';
import { Roles } from '@/common/decorators/roles.decorator';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { Role } from '@common/enums/role.enum';
import { JwtPayload } from '@common/interfaces/jwt-payload.interface';
import { documentUploadOptions } from '@/config/multer.config';
import { ApplicantActivityEventDto, ApplicantMatchDto, CompletenessResultDto } from './dto/applicant-views.dto';
import { contentDisposition, resolveContentType, resolveFileName } from '@/common/utils/content-disposition';

@ApiTags('Applications (ESO applicant)')
@ApiBearerAuth()
@Controller('applications')
@Roles(Role.ESO)
export class ApplicationsController {
  constructor(private readonly applicationsService: ApplicationsService) {}

  @ApiOkResponse({ description: 'The signed-in applicant\'s applications' })
  @ApiOperation({ summary: 'List my applications', description: 'Requires role: ROLE_ESO' })
  @Get('mine')
  findMine(@CurrentUser() user: JwtPayload) {
    return this.applicationsService.findMine(user.sub);
  }

  @ApiOperation({
    summary: 'My application timeline',
    description:
      'Requires role: ROLE_ESO (owner only). Applicant-safe milestones only — no reviewer identities, scores or internal escalations.',
  })
  @ApiOkResponse({ type: [ApplicantActivityEventDto] })
  @Get(':id/activity')
  activity(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.applicationsService.getApplicantActivity(user.sub, id);
  }

  @ApiOperation({
    summary: 'My confirmed host institution',
    description:
      'Requires role: ROLE_ESO (owner only). Returns matched=false until the application is MATCHED. Match scores are never exposed.',
  })
  @ApiOkResponse({ type: ApplicantMatchDto })
  @Get(':id/match')
  match(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.applicationsService.getApplicantMatch(user.sub, id);
  }

  @ApiOperation({
    summary: 'My matched cohort of beneficiaries',
    description:
      'Requires role: ROLE_ESO (owner only). Only beneficiaries ALLOCATED to the Centre of Excellence ' +
      'this application is matched to — 403 until the match is committed (application status MATCHED).',
  })
  @ApiOkResponse({ description: 'The institution this ESO is matched to, and its allocated beneficiaries.' })
  @Get(':id/beneficiaries')
  beneficiaries(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.applicationsService.getApplicantBeneficiaries(user.sub, id);
  }

  @ApiOkResponse({ description: 'The application with its documents, personnel and references' })
  @ApiOperation({ summary: 'Get one of my applications by ID', description: 'Requires role: ROLE_ESO' })
  @Get(':id')
  findOne(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.applicationsService.findOneOwned(user.sub, id);
  }

  @ApiOkResponse({ type: CompletenessResultDto })
  @ApiOperation({ summary: 'Get completeness checklist for an application', description: 'Requires role: ROLE_ESO' })
  @Get(':id/completeness')
  completeness(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.applicationsService.getCompleteness(user.sub, id);
  }

  @ApiCreatedResponse({ description: 'The saved draft (create-or-update); use the returned `version` when submitting' })
  @ApiOperation({ summary: 'Autosave/upsert the draft application', description: 'Requires role: ROLE_ESO' })
  @Post('draft')
  saveDraft(@CurrentUser() user: JwtPayload, @Body() dto: SaveDraftDto) {
    return this.applicationsService.saveDraft(user.sub, dto);
  }

  @ApiCreatedResponse({ description: 'The stored document record' })
  @ApiOperation({ summary: 'Upload a supporting document', description: 'Requires role: ROLE_ESO' })
  @Post(':id/upload-document')
  @UseInterceptors(FileInterceptor('file', documentUploadOptions))
  uploadDocument(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UploadDocumentDto,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.applicationsService.uploadDocument(
      user.sub,
      id,
      dto.documentType,
      file,
    );
  }

  @ApiOkResponse({ description: 'The file contents (binary)' })
  @ApiOperation({ summary: 'Download a document', description: 'Requires role: ROLE_ESO' })
  @Get(':id/documents/:documentId/download')
  async downloadDocument(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('documentId', ParseUUIDPipe) documentId: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { buffer, document } =
      await this.applicationsService.downloadDocument(user.sub, id, documentId);
    res.set({
      'Content-Type': resolveContentType(document.mimeType, document.originalFileName, document.storageKey),
      'Content-Disposition': contentDisposition(resolveFileName(document.originalFileName, document.storageKey)),
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'private, no-store',
    });
    return new StreamableFile(buffer);
  }

  @ApiOkResponse({ description: 'The document was removed' })
  @ApiOperation({ summary: 'Remove a document', description: 'Requires role: ROLE_ESO' })
  @Delete(':id/documents/:documentId')
  removeDocument(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('documentId', ParseUUIDPipe) documentId: string,
  ) {
    return this.applicationsService.removeDocument(user.sub, id, documentId);
  }

  @ApiOperation({
    summary: 'Submit the application for eligibility review',
    description:
      'Requires role: ROLE_ESO. Runs strict completeness validation, then transitions ' +
      'DRAFT/REWORK_REQUIRED -> SUBMITTED. Pass expectedVersion to get a 409 Conflict ' +
      'instead of a silent overwrite if the application changed since you last loaded it.',
  })
  @ApiCreatedResponse({ description: 'The application, now SUBMITTED. 422 lists what is missing; 409 means it changed since `version`.' })
  @Post('submit')
  submit(@CurrentUser() user: JwtPayload, @Body() dto: SubmitApplicationDto) {
    return this.applicationsService.submit(
      user.sub,
      dto.applicationId,
      dto.expectedVersion,
    );
  }
}
