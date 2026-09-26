import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Roles } from '@/common/decorators/roles.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Role } from '@/common/enums/role.enum';
import { JwtPayload } from '@/common/interfaces/jwt-payload.interface';
import { ScoringIntegrityService } from './scoring-integrity.service';
import { ScoringService } from './scoring.service';

export class CorrectScoringRejectionDto {
  @ApiProperty({ description: 'Why this rejection is being corrected (kept in the audit log)', minLength: 10 })
  @IsString()
  @MinLength(10)
  @MaxLength(2000)
  note!: string;
}

@ApiTags('Scoring integrity (SYSADMIN)')
@ApiBearerAuth()
@Controller('internal/admin/scoring-integrity')
@Roles(Role.SYSADMIN)
export class ScoringIntegrityController {
  constructor(
    private readonly integrity: ScoringIntegrityService,
    private readonly scoring: ScoringService,
  ) {}

  @ApiOperation({
    summary: 'Applications with a scoring integrity problem',
    description:
      'Requires role: ROLE_SYSADMIN. Lists applications rejected by the 70% scoring gate with a missing or invalid final score, ' +
      'rejections whose recomputed reviewer average actually meets the threshold, and applications whose finalization is on hold.',
  })
  @ApiOkResponse({ description: 'Items with stored score, recomputed average, variance and recommended outcome' })
  @Get()
  report() {
    return this.integrity.report();
  }

  @ApiOperation({
    summary: 'Re-run score finalization',
    description: 'Requires role: ROLE_SYSADMIN. For applications still in scoring whose finalization was put on hold.',
  })
  @Post(':applicationId/refinalize')
  refinalize(
    @Param('applicationId', ParseUUIDPipe) applicationId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.scoring.refinalize(applicationId, user);
  }

  @ApiOperation({
    summary: 'Correct a wrongful scoring-gate rejection',
    description:
      'Requires role: ROLE_SYSADMIN. Recomputes the average from the two submitted score cards. Over 15 points apart: moves to ' +
      'Pending validation for reconciliation. 70% or more: moves to Shortlisted and emails the applicant. Below 70%: keeps the ' +
      'rejection and stores the correct score. Every correction is audit logged with the note.',
  })
  @Post(':applicationId/correct')
  correct(
    @Param('applicationId', ParseUUIDPipe) applicationId: string,
    @Body() dto: CorrectScoringRejectionDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.integrity.correctRejection(applicationId, dto.note, user);
  }
}
