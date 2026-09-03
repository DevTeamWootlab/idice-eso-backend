// modules/notifications/providers/mail.provider.ts
import { Injectable } from '@nestjs/common';

@Injectable()
export class MailProvider {
  async send(to: string, subject: string, body: string): Promise<void> {
    // vendor integration pending
  }
}
