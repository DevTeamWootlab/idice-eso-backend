// modules/scoring/scoring.controller.ts
import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Body,
  Post,
} from '@nestjs/common';
import { ScoringService } from './scoring.service';
import { SubmitScoreDto } from './dto/submit-score.dto';
import { Roles } from '@/common/decorators/roles.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Role } from '@/common/enums/role.enum';
import { JwtPayload } from '@/common/interfaces/jwt-payload.interface';

@Controller('internal/applications')
@Roles(Role.SCORING_REVIEWER)
export class ScoringController {
  constructor(private readonly scoringService: ScoringService) {}

  @Get('queue/scoring')
  getQueue(@CurrentUser() user: JwtPayload) {
    return this.scoringService.getQueue(user.sub);
  }

  @Get(':id/scoring')
  getDossier(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.scoringService.getDossier(id, user.sub);
  }

  @Get(':id/scoring/mine')
  getMyScore(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.scoringService.getMyScore(id, user.sub);
  }

  @Post(':id/scoring/submit')
  submitScore(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SubmitScoreDto,
  ) {
    return this.scoringService.submitScore(id, user.sub, dto);
  }
}
