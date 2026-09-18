import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Res,
  StreamableFile,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApplicationsService } from './applications.service';
import { Roles } from '@/common/decorators/roles.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Role } from '@/common/enums/role.enum';
import { JwtPayload } from '@/common/interfaces/jwt-payload.interface';

/**
 * Shared read access for the four internal reviewer roles — document downloads and the
 * audit trail were previously reachable only by ROLE_ESO (the applicant themselves), so
 * an eligibility/scoring/validation reviewer had no way to actually open a document they
 * were meant to be auditing, and the "Audit trail" panel always rendered empty. Access is
 * scoped per-role the same way each queue's own dossier endpoint already scopes it.
 */
@ApiTags('Applications (internal reviewers)')
@ApiBearerAuth()
@Controller('internal/applications')
@Roles(
  Role.ELIGIBILITY_REVIEWER,
  Role.SCORING_REVIEWER,
  Role.VALIDATOR,
  Role.SYSADMIN,
)
export class InternalApplicationAccessController {
  constructor(private readonly applicationsService: ApplicationsService) {}

  @ApiOperation({
    summary: 'Download a document as an internal reviewer',
    description:
      'Requires role: ROLE_ELIGIBILITY_REVIEWER, ROLE_SCORING_REVIEWER, ROLE_VALIDATOR, ' +
      'or ROLE_SYSADMIN. Scoped the same way each role\'s own dossier endpoint is scoped ' +
      '(scoring: must be one of the two assigned reviewers; validator: must match the ' +
      "application's state).",
  })
  @Get(':id/documents/:documentId/download')
  async downloadDocument(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('documentId', ParseUUIDPipe) documentId: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { buffer, document } =
      await this.applicationsService.getDocumentForReviewer(id, documentId, user);
    res.set({
      'Content-Type': document.mimeType,
      'Content-Disposition': `attachment; filename="${document.originalFileName}"`,
    });
    return new StreamableFile(buffer);
  }

  @ApiOperation({
    summary: "Get an application's audit trail",
    description:
      'Requires role: ROLE_ELIGIBILITY_REVIEWER, ROLE_SCORING_REVIEWER, ROLE_VALIDATOR, ' +
      'or ROLE_SYSADMIN. Same scoping as the document download route above.',
  })
  @Get(':id/audit-log')
  getAuditLog(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.applicationsService.getAuditLogForReviewer(id, user);
  }
}
