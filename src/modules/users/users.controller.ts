import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags, ApiCreatedResponse, ApiOkResponse, ApiConflictResponse } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { ProvisionInternalUserDto } from './dto/provision-internal-user.dto';
import { ListInternalUsersDto } from './dto/list-internal-users.dto';
import { UpdateInternalUserDto } from './dto/update-internal-user.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { ResetInternalUserPasswordDto } from './dto/reset-internal-user-password.dto';
import { Roles } from '@/common/decorators/roles.decorator';
import { Role } from '@/common/enums/role.enum';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { JwtPayload } from '@/common/interfaces/jwt-payload.interface';

@ApiTags('Users (SYSADMIN)')
@ApiBearerAuth()
@Controller('internal/users')
@Roles(Role.SYSADMIN)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @ApiOperation({
    summary: 'List internal users',
    description:
      'Requires role: ROLE_SYSADMIN. Lists provisioned ROLE_ELIGIBILITY_REVIEWER, ' +
      'ROLE_SCORING_REVIEWER, ROLE_VALIDATOR, and ROLE_SYSADMIN accounts, optionally ' +
      'filtered to one role via ?role=. Used to populate reviewer/validator assignment ' +
      "pickers — never returns ROLE_ESO applicants.",
  })
  @ApiOkResponse({ description: 'List internal users.' })
  @Get()
  list(@Query() query: ListInternalUsersDto) {
    return this.usersService.listInternalUsers(query.role);
  }

  @ApiOperation({
    summary: 'Provision an internal user',
    description:
      'Requires role: ROLE_SYSADMIN. Provisions ROLE_ELIGIBILITY_REVIEWER, ' +
      'ROLE_SCORING_REVIEWER, ROLE_VALIDATOR, or ROLE_SYSADMIN accounts. ROLE_ESO applicants ' +
      'self-register via POST /auth/register instead.',
  })
  @ApiCreatedResponse({ description: 'Provision an internal user.' })
  @Post()
  provision(@Body() dto: ProvisionInternalUserDto) {
    return this.usersService.provisionInternalUser(dto);
  }

  @ApiOperation({
    summary: 'Activate or suspend an internal user',
    description:
      'Requires role: ROLE_SYSADMIN. Deactivating an account with open work (unscored assignments, or the ' +
      "sole active validator for a state with pending work) is refused with a 409 and a breakdown of what's " +
      'open, unless acknowledgeOpenWork is set — the last active administrator can never be deactivated.',
  })
  @ApiOkResponse({ description: 'Activate or suspend an internal user.' })
  @Patch(':id/status')
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserStatusDto,
    @CurrentUser() actor: JwtPayload,
  ) {
    return this.usersService.setActive(id, dto.isActive, actor.sub, dto.reason, dto.acknowledgeOpenWork);
  }

  @ApiOperation({
    summary: 'Preview what is tied to an internal account before deactivating it',
    description:
      'Requires role: ROLE_SYSADMIN. Unscored assignments, sole-validator coverage of a state with pending ' +
      'work, and last-active-administrator status. Used to populate the deactivation confirmation dialog.',
  })
  @ApiOkResponse({ description: 'What is tied to this account.' })
  @Get(':id/deactivation-impact')
  deactivationImpact(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.getDeactivationImpact(id);
  }

  @ApiOperation({
    summary: "Reset a user's password",
    description:
      'Requires role: ROLE_SYSADMIN. Generates a new temporary password (the old one cannot be recovered, ' +
      'only its hash is stored) and returns it once for display in the persistent credentials panel. ' +
      'Use when credentials are lost.',
  })
  @ApiCreatedResponse({ description: 'The new temporary password, shown once.' })
  @Post(':id/reset-password')
  resetPassword(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ResetInternalUserPasswordDto,
    @CurrentUser() actor: JwtPayload,
  ) {
    return this.usersService.resetPassword(id, actor.sub, dto);
  }

  @ApiOperation({
    summary: 'Edit an internal user',
    description:
      'Requires role: ROLE_SYSADMIN. Change name, role, validator state or scoring-reviewer slot. ' +
      'Refused when it would leave no active administrator, orphan unscored review work, or exceed two scoring reviewers.',
  })
  @ApiOkResponse({ description: 'The updated user.' })
  @ApiConflictResponse({ description: 'Reviewer slot taken or more than two active scoring reviewers' })
  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateInternalUserDto,
    @CurrentUser() actor: JwtPayload,
  ) {
    return this.usersService.updateInternalUser(id, dto, actor.sub);
  }

  @ApiOperation({
    summary: "Reset a user's two-factor authentication",
    description:
      'Requires role: ROLE_SYSADMIN. Removes the internal user\'s authenticator secret and backup codes so they are asked to enrol again at their next sign-in. Use when someone is locked out.',
  })
  @ApiCreatedResponse({ description: 'Two-factor authentication was reset.' })
  @Post(':id/reset-mfa')
  resetMfa(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() actor: JwtPayload) {
    return this.usersService.resetMfa(id, actor.sub);
  }

  @ApiOperation({
    summary: 'Resend the invitation email',
    description:
      'Requires role: ROLE_SYSADMIN. Re-sends the activation link to an invited user who has not yet verified their email. Limited to one per minute.',
  })
  @ApiCreatedResponse({ description: 'The invitation was re-sent.' })
  @Post(':id/resend-invite')
  resendInvite(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() actor: JwtPayload) {
    return this.usersService.resendInvite(id, actor.sub);
  }
}