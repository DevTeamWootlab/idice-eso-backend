import { Body, Controller, Post } from '@nestjs/common';
import { UsersService } from './users.service';
import { ProvisionInternalUserDto } from './dto/provision-internal-user.dto';
import { Roles } from '@/common/decorators/roles.decorator';
import { Role } from '@/common/enums/role.enum';

@Controller('internal/users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @Roles(Role.SYSADMIN)
  provision(@Body() dto: ProvisionInternalUserDto) {
    return this.usersService.provisionInternalUser(dto);
  }
}
