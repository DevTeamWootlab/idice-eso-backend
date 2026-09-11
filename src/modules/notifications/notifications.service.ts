// modules/notifications/notifications.service.ts
import { Injectable } from '@nestjs/common';
import { MailProvider } from './providers/mail.provider';
import { SmsProvider } from './providers/sms.provider';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class NotificationsService {
  constructor(
    private readonly mail: MailProvider,
    private readonly sms: SmsProvider,
    private readonly configService: ConfigService,
  ) {}

  async sendEmailVerification(applicantEmail: string, token: string) {
    const appUrl = this.configService.get<string>('app.frontendUrl');
    const link = `${appUrl}/verify-email?token=${token}`;
    await this.mail.send(
      applicantEmail,
      'Verify your email',
      `Click to verify: ${link}`,
    );
  }

  async sendPasswordReset(email: string, token: string) {
    const appUrl = this.configService.get<string>('app.frontendUrl');
    const link = `${appUrl}/reset-password?token=${token}`;
    await this.mail.send(
      email,
      'Reset your password',
      `Click to reset your password: ${link}`,
    );
  }

  async sendEligibilityRejection(email: string, remarks: string) {
    await this.mail.send(
      email,
      'Application Update — iDICE ESO Portal',
      `Your application was not successful at the eligibility stage. Reason: ${remarks}`,
    );
  }

  async sendReworkRequested(email: string, notes: string[]) {
    await this.mail.send(
      email,
      'Action Required — iDICE ESO Application',
      `Please review and resubmit your application. Notes: ${notes.join('; ')}`,
    );
  }

  async sendBeneficiaryConfirmation(
    email: string,
    phone: string,
    referenceId: string,
  ) {
    // await this.mail.send(/* ... */);
    // await this.sms.send(/* ... */);
  }
}
