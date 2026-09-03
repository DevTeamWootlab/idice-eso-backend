// modules/notifications/notifications.module.ts
import { Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { MailProvider } from './providers/mail.provider';
import { SmsProvider } from './providers/sms.provider';

@Module({
  providers: [NotificationsService, MailProvider, SmsProvider],
  exports: [NotificationsService],
})
export class NotificationsModule {}
