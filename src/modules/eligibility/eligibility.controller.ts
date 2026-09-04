import { Controller, Get } from '@nestjs/common';
import { Roles } from '@/common/decorators/roles.decorator';
import { Role } from '@/common/enums/role.enum';

@Controller('internal/applications')
export class EligibilityController {
  @Get()
  @Roles(Role.ELIGIBILITY_REVIEWER)
  findQueue() {
    // ...
  }
}
