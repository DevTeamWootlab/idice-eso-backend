import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '@/common/decorators/roles.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Role } from '@/common/enums/role.enum';
import { JwtPayload } from '@/common/interfaces/jwt-payload.interface';
import { EsoTrainingService } from './eso-training.service';
import {
  EnrollBeneficiariesDto,
  EsoCreateCohortDto,
  RecordCompletionsDto,
  UpdateCohortDto,
  UpdateCohortStatusDto,
} from './dto/training.dto';
import { CompletionsResultDto } from './dto/training-responses.dto';

@ApiTags('ESO Training Cohorts (ESO)')
@ApiBearerAuth()
@Controller('eso/training')
@Roles(Role.ESO)
@ApiForbiddenResponse({
  description: 'The organisation is not matched yet, or the cohort belongs to another Centre of Excellence',
})
export class EsoTrainingController {
  constructor(private readonly esoTrainingService: EsoTrainingService) {}

  @ApiOperation({ summary: 'List active courses', description: 'Requires role: ROLE_ESO.' })
  @ApiOkResponse({ description: 'Active courses, by tier then title' })
  @Get('courses')
  courses() {
    return this.esoTrainingService.listCourses();
  }

  @ApiOperation({
    summary: 'Cohorts at my Centres of Excellence',
    description:
      "Requires role: ROLE_ESO (matched). Cohorts at every Centre of Excellence the ESO is approved to run, with member, completion and certification counts.",
  })
  @ApiOkResponse({ description: 'Cohorts, newest start date first' })
  @Get('cohorts')
  cohorts(@CurrentUser() user: JwtPayload) {
    return this.esoTrainingService.listCohorts(user.sub);
  }

  @ApiOperation({
    summary: 'Create a cohort at one of my Centres of Excellence',
    description:
      "Requires role: ROLE_ESO (matched). The cohort is created at one of the ESO's approved Centres of Excellence. " +
      'Send institutionId when the ESO runs more than one centre.',
  })
  @ApiCreatedResponse({ description: 'The new cohort (status PLANNED)' })
  @Post('cohorts')
  create(@CurrentUser() user: JwtPayload, @Body() dto: EsoCreateCohortDto) {
    return this.esoTrainingService.createCohort(user, dto);
  }

  @ApiOperation({ summary: 'Edit one of my cohorts (name, dates, capacity)', description: 'Requires role: ROLE_ESO (owner).' })
  @ApiOkResponse({ description: 'The updated cohort' })
  @Patch('cohorts/:id')
  update(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateCohortDto) {
    return this.esoTrainingService.updateCohort(user, id, dto);
  }

  @ApiOperation({
    summary: 'Change one of my cohorts’ status',
    description:
      'Requires role: ROLE_ESO (owner). PLANNED → ACTIVE / PAUSED / CANCELLED; ACTIVE → COMPLETED / PAUSED / CANCELLED; PAUSED → PLANNED / ACTIVE / CANCELLED.',
  })
  @ApiOkResponse({ description: 'The updated cohort' })
  @Patch('cohorts/:id/status')
  status(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateCohortStatusDto) {
    return this.esoTrainingService.updateCohortStatus(user, id, dto);
  }

  @ApiOperation({ summary: 'Members of one of my cohorts with completion state', description: 'Requires role: ROLE_ESO (owner).' })
  @ApiOkResponse({ description: 'Members, by name' })
  @Get('cohorts/:id/members')
  members(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.esoTrainingService.listMembers(user, id);
  }

  @ApiOperation({
    summary: 'Enrol my allocated beneficiaries in one of my cohorts',
    description:
      'Requires role: ROLE_ESO (owner). Only ALLOCATED Talent Development (Skills) beneficiaries assigned to this Centre of Excellence ' +
      'are accepted; each ID comes back as ENROLLED, ALREADY_ENROLLED, COHORT_FULL, REJECTED (with reason) or BENEFICIARY_NOT_FOUND.',
  })
  @ApiCreatedResponse({ description: 'Per-beneficiary enrolment outcome' })
  @Post('cohorts/:id/enroll')
  enroll(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string, @Body() dto: EnrollBeneficiariesDto) {
    return this.esoTrainingService.enroll(user, id, dto);
  }

  @ApiOperation({
    summary: 'Record attendance, completion and certification for my cohort members',
    description: 'Requires role: ROLE_ESO (owner). Only for ACTIVE or COMPLETED cohorts. Certified requires completed.',
  })
  @ApiCreatedResponse({ description: 'How many records were saved and which were rejected' })
  @Post('cohorts/:id/completions')
  completions(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RecordCompletionsDto,
  ): Promise<CompletionsResultDto> {
    return this.esoTrainingService.recordCompletions(user, id, dto);
  }
}
