// modules/notifications/notifications.service.ts
import { Injectable } from '@nestjs/common';
import { MailProvider } from './providers/mail.provider';
import { SmsProvider } from './providers/sms.provider';

@Injectable()
export class NotificationsService {
  constructor(
    private readonly mail: MailProvider,
    private readonly sms: SmsProvider,
  ) {}

  async sendEligibilityRejection(applicantEmail: string, remarks: string) {
    // uses templates/rejection-eligibility.template.ts
  }

  async sendReworkRequested(applicantEmail: string, sectionNotes: string[]) {
    // uses templates/rework-requested.template.ts
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
