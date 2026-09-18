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
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApplicationsService } from './applications.service';
import { SaveDraftDto } from './dto/save-draft.dto';
import { SubmitApplicationDto } from './dto/submit-application.dto';
import { UploadDocumentDto } from './dto/upload-document.dto';
import { Roles } from '@/common/decorators/roles.decorator';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { Role } from '@common/enums/role.enum';
import { JwtPayload } from '@common/interfaces/jwt-payload.interface';
import { documentUploadOptions } from '@/config/multer.config';

@ApiTags('Applications (ESO applicant)')
@ApiBearerAuth()
@Controller('applications')
@Roles(Role.ESO)
export class ApplicationsController {
  constructor(private readonly applicationsService: ApplicationsService) {}

  @ApiOperation({ summary: 'List my applications', description: 'Requires role: ROLE_ESO' })
  @Get('mine')
  findMine(@CurrentUser() user: JwtPayload) {
    return this.applicationsService.findMine(user.sub);
  }

  @ApiOperation({ summary: 'Get one of my applications by ID', description: 'Requires role: ROLE_ESO' })
  @Get(':id')
  findOne(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.applicationsService.findOneOwned(user.sub, id);
  }

  @ApiOperation({ summary: 'Get completeness checklist for an application', description: 'Requires role: ROLE_ESO' })
  @Get(':id/completeness')
  completeness(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.applicationsService.getCompleteness(user.sub, id);
  }

  @ApiOperation({ summary: 'Autosave/upsert the draft application', description: 'Requires role: ROLE_ESO' })
  @Post('draft')
  saveDraft(@CurrentUser() user: JwtPayload, @Body() dto: SaveDraftDto) {
    return this.applicationsService.saveDraft(user.sub, dto);
  }

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
      'Content-Type': document.mimeType,
      'Content-Disposition': `attachment; filename="${document.originalFileName}"`,
    });
    return new StreamableFile(buffer);
  }

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
  @Post('submit')
  submit(@CurrentUser() user: JwtPayload, @Body() dto: SubmitApplicationDto) {
    return this.applicationsService.submit(
      user.sub,
      dto.applicationId,
      dto.expectedVersion,
    );
  }
}
