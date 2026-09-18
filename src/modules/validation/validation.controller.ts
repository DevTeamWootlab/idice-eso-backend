import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ValidationService } from './validation.service';
import { SubmitValidationDto } from './dto/submit-validation.dto';
import { ResolveVarianceDto } from './dto/resolve-variance.dto';
import { UploadSiteVisitPhotoDto } from './dto/upload-site-visit-photo.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Role } from '../../common/enums/role.enum';
import { JwtPayload } from '../../common/interfaces/jwt-payload.interface';
import { documentUploadOptions } from '@/config/multer.config';

@ApiTags('Field validation')
@ApiBearerAuth()
@Controller('internal/applications')
@Roles(Role.VALIDATOR)
export class ValidationController {
  constructor(private readonly validationService: ValidationService) {}

  @ApiOperation({
    summary: 'Get my field validation queue',
    description:
      'Requires role: ROLE_VALIDATOR. Scoped to the validator\'s assignedState via the ' +
      'application\'s preferredInstitution.state.',
  })
  @Get('queue/validation')
  getQueue(@CurrentUser() user: JwtPayload) {
    return this.validationService.getQueue(user.sub);
  }

  @ApiOperation({ summary: 'Get an application dossier for field validation', description: 'Requires role: ROLE_VALIDATOR' })
  @Get(':id/validation')
  getDossier(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.validationService.getDossier(id, user.sub);
  }

  @ApiOperation({ summary: 'Submit a field validation record', description: 'Requires role: ROLE_VALIDATOR' })
  @Post(':id/validation/submit')
  submitValidation(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SubmitValidationDto,
  ) {
    return this.validationService.submitValidation(id, user.sub, dto);
  }

  @ApiOperation({
    summary: 'Upload a geotagged site-visit photo',
    description:
      'Requires role: ROLE_VALIDATOR. Uploads one photo and returns a descriptor ' +
      '(storageKey/latitude/longitude/takenAt) — the frontend accumulates these ' +
      "client-side and includes the full array in the submit-validation call's " +
      'geotaggedPhotos field, since a ValidationRecord does not exist until submission.',
  })
  @ApiConsumes('multipart/form-data')
  @Post(':id/validation/photos')
  @UseInterceptors(FileInterceptor('file', documentUploadOptions))
  uploadSiteVisitPhoto(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UploadSiteVisitPhotoDto,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.validationService.uploadSiteVisitPhoto(
      id,
      user.sub,
      file,
      dto.latitude,
      dto.longitude,
    );
  }

  @ApiOperation({
    summary: 'Reconcile a >15% score-variance escalation',
    description:
      "Requires role: ROLE_VALIDATOR. For applications the scoring stage routed to " +
      'PENDING_VALIDATION because the two reviewers\' composite scores diverged by ' +
      'more than 15% (TC-SCO-04). The Lead Evaluator enters a reconciled composite ' +
      'score and a mandatory note; the standard 70% qualification threshold still ' +
      'applies (>=70 -> SHORTLISTED, otherwise REJECTED). Scoped to the validator\'s ' +
      "assigned state, same as the rest of this controller.",
  })
  @Post(':id/resolve-variance')
  resolveVariance(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ResolveVarianceDto,
  ) {
    return this.validationService.resolveVariance(id, user.sub, dto);
  }
}
