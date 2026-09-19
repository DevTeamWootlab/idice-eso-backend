// modules/notifications/notifications.module.ts
import { Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { MailProvider } from './providers/mail.provider';
import { SmsProvider } from './providers/sms.provider';
import { NotificationsController } from './notifications.controller';
import { InAppNotificationsService } from './in-app-notifications.service';

@Module({
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    InAppNotificationsService,
    MailProvider,
    SmsProvider,
  ],
  exports: [NotificationsService, InAppNotificationsService],
})
export class NotificationsModule {}
