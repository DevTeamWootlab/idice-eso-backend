import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { ProvisionInternalUserDto } from './dto/provision-internal-user.dto';
import { ListInternalUsersDto } from './dto/list-internal-users.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { Roles } from '@/common/decorators/roles.decorator';
import { Role } from '@/common/enums/role.enum';

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
  @Post()
  provision(@Body() dto: ProvisionInternalUserDto) {
    return this.usersService.provisionInternalUser(dto);
  }

  @ApiOperation({
    summary: 'Activate or suspend an internal user',
    description: 'Requires role: ROLE_SYSADMIN.',
  })
  @Patch(':id/status')
  updateStatus(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateUserStatusDto) {
    return this.usersService.setActive(id, dto.isActive);
  }
}
