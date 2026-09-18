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

  /**
   * Every notification link was hardcoded to `http://idice.eso.wootlab.ng` — this
   * ignores the FRONTEND_URL env var that already exists in configuration.ts (it was
   * read into a local `appUrl` and then never used — left commented out above every
   * call site). That means any deployment on a different domain (staging, a preview
   * URL, or simply a future domain change) would silently email verification/reset/
   * status links pointing at the wrong place. Centralized here so there's one place
   * to get it right, falling back to the original hardcoded domain only if
   * FRONTEND_URL isn't set.
   */
  private frontendUrl(): string {
    return (
      this.configService.get<string>('app.frontendUrl') ||
      'http://idice.eso.wootlab.ng'
    );
  }

  async sendEmailVerification(applicantEmail: string, token: string) {
    const link = `${this.frontendUrl()}/verify-email?token=${token}`;
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
    // Was /reset-password?token=... — the frontend's token-handling page is actually
    // at /reset-password/confirm (the base /reset-password page is the "request a
    // reset email" form and ignores any query string), so the emailed link landed on
    // the wrong page and the token was never read.
    const link = `${this.frontendUrl()}/reset-password/confirm?token=${token}`;
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
        `${this.frontendUrl()}/applications`,
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
        `${this.frontendUrl()}/applications`,
      ),
    );
  }

  async sendShortlistedNotification(email: string, scorePercent: number) {
    await this.mail.send(
      email,
      'Application Shortlisted — iDICE ESO Portal',
      this.renderHtmlTemplate(
        'Your application has been shortlisted',
        `Your application scored ${scorePercent}% and has been shortlisted for local ecosystem validation.`,
        'View application',
        `${this.frontendUrl()}/applications`,
      ),
    );
  }

  async sendMatchedNotification(email: string, institutionName: string) {
    await this.mail.send(
      email,
      'You have been matched — iDICE ESO Portal',
      this.renderHtmlTemplate(
        'Partner match confirmed',
        `Congratulations — your organisation has been matched to ${institutionName} as its Enterprise Support Organisation partner.`,
        'View application',
        `${this.frontendUrl()}/applications`,
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
        `${this.frontendUrl()}/applications`,
      ),
    );
  }

  /**
   * Was a complete no-op stub (both mail.send and sms.send commented out) and — more
   * importantly — was never even called from BeneficiariesService.registerIntake(),
   * so a beneficiary submitting the public intake form got no confirmation of any
   * kind, just whatever the frontend's success screen showed them client-side. Now
   * implemented and wired in (see beneficiaries.service.ts). SMS silently no-ops
   * until a real vendor is configured (SmsProvider.send is a stub — "vendor
   * integration pending" — this call doesn't change that, it's just no longer
   * commented out for when it is wired up).
   */
  async sendBeneficiaryConfirmation(
    email: string,
    phone: string,
    referenceId: string,
  ) {
    await this.mail.send(
      email,
      'We received your application — iDICE Youth Programme',
      this.renderHtmlTemplate(
        'Application received',
        `Thank you for applying to the iDICE Youth Employment & Enterprise Programme. ` +
          `Your reference number is <strong>${referenceId}</strong> — please keep it for your records. ` +
          `We'll be in touch with next steps.`,
        'iDICE Youth Programme',
        this.frontendUrl(),
      ),
    );
    await this.sms.send(
      phone,
      `iDICE: We received your application. Your reference number is ${referenceId}. Keep it for your records.`,
    );
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
