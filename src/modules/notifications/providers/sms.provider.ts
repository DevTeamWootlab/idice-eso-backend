// modules/notifications/providers/sms.provider.ts
import { Injectable } from '@nestjs/common';

@Injectable()
export class SmsProvider {
  async send(to: string, message: string): Promise<void> {
    // vendor integration pending
  }
}
