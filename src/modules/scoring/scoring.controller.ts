// modules/scoring/scoring.controller.ts
import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Body,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags, ApiCreatedResponse, ApiOkResponse } from '@nestjs/swagger';
import { ScoringService } from './scoring.service';
import { SubmitScoreDto } from './dto/submit-score.dto';
import { Roles } from '@/common/decorators/roles.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Role } from '@/common/enums/role.enum';
import { JwtPayload } from '@/common/interfaces/jwt-payload.interface';

@ApiTags('Scoring review')
@ApiBearerAuth()
@Controller('internal/applications')
@Roles(Role.SCORING_REVIEWER)
export class ScoringController {
  constructor(private readonly scoringService: ScoringService) {}

  @ApiOkResponse({ description: 'Get my scoring queue.' })
  @ApiOperation({ summary: 'Get my scoring queue', description: 'Requires role: ROLE_SCORING_REVIEWER' })
  @Get('queue/scoring')
  getQueue(@CurrentUser() user: JwtPayload) {
    return this.scoringService.getQueue(user.sub);
  }

  @ApiOkResponse({ description: 'Applications I have scored, with my own score and the final score once published.' })
  @ApiOperation({
    summary: 'List the applications I have scored',
    description:
      'Requires role: ROLE_SCORING_REVIEWER. Shows the caller\'s own submitted score. The final (averaged) score ' +
      'appears only once scoring has finalized, so the co-reviewer stays blind until both have submitted.',
  })
  @Get('queue/scoring/submitted')
  getSubmitted(@CurrentUser() user: JwtPayload) {
    return this.scoringService.getSubmittedByMe(user.sub);
  }

  @ApiOkResponse({ description: 'Get an application dossier for scoring.' })
  @ApiOperation({ summary: 'Get an application dossier for scoring', description: 'Requires role: ROLE_SCORING_REVIEWER' })
  @Get(':id/scoring')
  getDossier(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.scoringService.getDossier(id, user.sub);
  }

  @ApiOperation({
    summary: 'Get my own score card',
    description:
      'Requires role: ROLE_SCORING_REVIEWER. Reviewer 1 and 2 are blind to each other until ' +
      'both have submitted — always returns only the caller\'s own card.',
  })
  @ApiOkResponse({ description: 'Get my own score card.' })
  @Get(':id/scoring/mine')
  getMyScore(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.scoringService.getMyScore(id, user.sub);
  }

  @ApiCreatedResponse({ description: 'Submit my score card.' })
  @ApiOperation({ summary: 'Submit my score card', description: 'Requires role: ROLE_SCORING_REVIEWER' })
  @Post(':id/scoring/submit')
  submitScore(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SubmitScoreDto,
  ) {
    return this.scoringService.submitScore(id, user.sub, dto);
  }
}
