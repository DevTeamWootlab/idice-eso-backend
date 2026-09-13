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
    // const appUrl = this.configService.get<string>('app.frontendUrl');
    const link = `http://idice.eso.wootlab.ng/verify-email?token=${token}`;
    await this.mail.send(
      applicantEmail,
      'Verify your email',
      this.renderHtmlTemplate(
        'Verify your email',
        `Click the button below to verify your email address and continue with your application.`,
        'Verify email',
        link,
      ),
    );
  }

  async sendPasswordReset(email: string, token: string) {
    // const appUrl = this.configService.get<string>('app.frontendUrl');
    const link = `http://idice.eso.wootlab.ng/reset-password?token=${token}`;
    await this.mail.send(
      email,
      'Reset your password',
      this.renderHtmlTemplate(
        'Reset your password',
        'Use the button below to reset your password and regain access to your account.',
        'Reset password',
        link,
      ),
    );
  }

  async sendEligibilityRejection(email: string, remarks: string) {
    await this.mail.send(
      email,
      'Application Update — iDICE ESO Portal',
      this.renderHtmlTemplate(
        'Application update',
        `Your application was not successful at the eligibility stage. Reason: ${remarks}`,
        'Review application status',
        `http://idice.eso.wootlab.ng/applications`,
      ),
    );
  }

  async sendReworkRequested(email: string, notes: string[]) {
    await this.mail.send(
      email,
      'Action Required — iDICE ESO Application',
      this.renderHtmlTemplate(
        'Action required',
        `Please review and resubmit your application. Notes: ${notes.join('; ')}`,
        'Open application',
        `http://idice.eso.wootlab.ng/applications`,
      ),
    );
  }

  async sendDisqualificationNotification(email: string, reason: string) {
    await this.mail.send(
      email,
      'Application status — iDICE ESO Portal',
      this.renderHtmlTemplate(
        'Application status update',
        `Your application has been discontinued from the current selection cycle. Reason: ${reason}`,
        'View update',
        `http://idice.eso.wootlab.ng/applications`,
      ),
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

  private renderHtmlTemplate(
    title: string,
    message: string,
    buttonLabel: string,
    actionUrl: string,
  ) {
    return `
      <div style="font-family: Arial, sans-serif; background:#f4f7fb; padding:24px; color:#0f172a;">
        <div style="max-width:600px; margin:0 auto; background:#ffffff; border-radius:12px; padding:32px; border:1px solid #e2e8f0;">
          <h2 style="margin:0 0 16px; color:#0f172a;">${title}</h2>
          <p style="margin:0 0 20px; line-height:1.6; font-size:15px;">${message}</p>
          <a href="${actionUrl}" style="display:inline-block; background:#00a0e3; color:#ffffff; text-decoration:none; padding:12px 20px; border-radius:8px; font-weight:bold;">
            ${buttonLabel}
          </a>
          <p style="margin-top:20px; font-size:12px; color:#475569;">If the button does not work, copy and open this link in your browser:<br />${actionUrl}</p>
        </div>
      </div>
    `;
  }
}
