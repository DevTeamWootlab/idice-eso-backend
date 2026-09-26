import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags, ApiOkResponse, ApiCreatedResponse } from '@nestjs/swagger';
import { Roles } from '@/common/decorators/roles.decorator';
import { Role } from '@/common/enums/role.enum';
import { TrainingService } from './training.service';
import {
  CreateCohortDto,
  EnrollBeneficiariesDto,
  RecordCompletionsDto,
  UpdateCohortDto,
  UpdateCohortStatusDto,
} from './dto/training.dto';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { JwtPayload } from '@/common/interfaces/jwt-payload.interface';
import { CourseDto, CohortDto, CohortMemberDto, EnrolResultDto, CompletionsResultDto } from './dto/training-responses.dto';

@ApiTags('Training (SYSADMIN)')
@ApiBearerAuth()
@Controller('internal/training')
@Roles(Role.SYSADMIN)
export class TrainingController {
  constructor(private readonly trainingService: TrainingService) {}

  @ApiOkResponse({ type: [CourseDto] })
  @ApiOperation({ summary: 'List active courses', description: 'Requires role: ROLE_SYSADMIN' })
  @Get('courses')
  courses() {
    return this.trainingService.listCourses();
  }

  @ApiOkResponse({ type: [CohortDto] })
  @ApiOperation({ summary: 'List cohorts with member counts', description: 'Requires role: ROLE_SYSADMIN' })
  @Get('cohorts')
  cohorts() {
    return this.trainingService.listCohorts();
  }

  @ApiCreatedResponse({ type: CohortDto })
  @ApiOperation({ summary: 'Create a cohort at a CoE', description: 'Requires role: ROLE_SYSADMIN' })
  @Post('cohorts')
  createCohort(@Body() dto: CreateCohortDto) {
    return this.trainingService.createCohort(dto);
  }

  @ApiOperation({
    summary: 'Move a cohort PLANNED → ACTIVE → COMPLETED, pause or resume it, or cancel it',
    description: 'Requires role: ROLE_SYSADMIN',
  })
  @ApiOkResponse({ type: CohortDto })
  @Patch('cohorts/:id/status')
  updateCohortStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCohortStatusDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.trainingService.updateCohortStatus(id, dto, user);
  }

  @ApiOperation({
    summary: 'Edit a cohort’s name, dates or capacity',
    description:
      'Requires role: ROLE_SYSADMIN. Only planned, active or paused cohorts can be edited. Capacity cannot drop below the number of trainees already enrolled.',
  })
  @ApiOkResponse({ type: CohortDto })
  @Patch('cohorts/:id')
  updateCohort(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCohortDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.trainingService.updateCohort(id, dto, user);
  }

  @ApiOperation({
    summary: 'List a cohort’s members with their completion state',
    description: 'Requires role: ROLE_SYSADMIN',
  })
  @ApiOkResponse({ type: [CohortMemberDto] })
  @Get('cohorts/:id/members')
  members(@Param('id', ParseUUIDPipe) id: string) {
    return this.trainingService.listMembers(id);
  }

  @ApiOperation({
    summary: 'Enrol allocated beneficiaries in a cohort',
    description:
      'Requires role: ROLE_SYSADMIN. Only ALLOCATED Skills-pillar beneficiaries assigned to the ' +
      "cohort's CoE are accepted; the response lists who was enrolled, already enrolled, or rejected and why.",
  })
  @ApiCreatedResponse({ type: EnrolResultDto })
  @Post('cohorts/:id/enroll')
  enroll(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: EnrollBeneficiariesDto,
  ): Promise<EnrolResultDto> {
    return this.trainingService.enroll(id, dto);
  }

  @ApiOperation({
    summary: 'Record course completion / certification for cohort members',
    description:
      'Requires role: ROLE_SYSADMIN. Completed trainees feed the PCU skill-tier progress and are ' +
      'the denominator of the job-placement rate.',
  })
  @ApiCreatedResponse({ type: CompletionsResultDto })
  @Post('cohorts/:id/completions')
  recordCompletions(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RecordCompletionsDto,
  ): Promise<CompletionsResultDto> {
    return this.trainingService.recordCompletions(id, dto);
  }
}