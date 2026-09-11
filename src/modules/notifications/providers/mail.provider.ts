import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class MailProvider {
  private readonly logger = new Logger(MailProvider.name);

  constructor(private readonly configService: ConfigService) {}

  async send(to: string, subject: string, body: string): Promise<void> {
    const env = this.configService.get<string>('app.env');
    console.log(`[DEV EMAIL] To: ${to} | Subject: ${subject}\n${body}`);
    if (env !== 'production') {
      this.logger.log(`[DEV EMAIL] To: ${to} | Subject: ${subject}\n${body}`);
      return;
    }

    // SendGrid/SES integration goes here once a vendor is picked
    throw new Error(
      'MailProvider has no production implementation configured yet',
    );
  }
}
