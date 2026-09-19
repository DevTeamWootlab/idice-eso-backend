import { Controller, Get, HttpCode, HttpStatus, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { JwtPayload } from '@/common/interfaces/jwt-payload.interface';
import { InAppNotificationsService } from './in-app-notifications.service';
import {
  InAppNotificationListDto,
  ListNotificationsDto,
  MarkedReadDto,
} from './dto/in-app-notification.dto';

@ApiTags('Notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly inApp: InAppNotificationsService) {}

  @ApiOperation({
    summary: 'My in-app notifications',
    description: 'Any authenticated role. Newest first, with the total unread count.',
  })
  @ApiOkResponse({ type: InAppNotificationListDto })
  @Get()
  list(@CurrentUser() user: JwtPayload, @Query() query: ListNotificationsDto) {
    return this.inApp.listMine(user.sub, query.limit);
  }

  @ApiOperation({
    summary: 'Mark all my notifications as read',
    description: 'Any authenticated role.',
  })
  @ApiOkResponse({ type: MarkedReadDto })
  @HttpCode(HttpStatus.OK)
  @Post('read-all')
  readAll(@CurrentUser() user: JwtPayload) {
    return this.inApp.markAllRead(user.sub);
  }
}
