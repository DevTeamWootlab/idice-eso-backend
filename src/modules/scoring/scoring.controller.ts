// modules/scoring/scoring.controller.ts
import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Body,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
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

  @ApiOperation({ summary: 'Get my scoring queue', description: 'Requires role: ROLE_SCORING_REVIEWER' })
  @Get('queue/scoring')
  getQueue(@CurrentUser() user: JwtPayload) {
    return this.scoringService.getQueue(user.sub);
  }

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
  @Get(':id/scoring/mine')
  getMyScore(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.scoringService.getMyScore(id, user.sub);
  }

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
