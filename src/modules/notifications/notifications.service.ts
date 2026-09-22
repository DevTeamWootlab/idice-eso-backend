import { Injectable } from '@nestjs/common';
import { MailProvider } from './providers/mail.provider';
import { SmsProvider } from './providers/sms.provider';
import { ConfigService } from '@nestjs/config';
import { InAppNotificationsService } from './in-app-notifications.service';

@Injectable()
export class NotificationsService {
  constructor(
    private readonly mail: MailProvider,
    private readonly sms: SmsProvider,
    private readonly configService: ConfigService,
    private readonly inApp: InAppNotificationsService,
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
    const configured =
      this.configService.get<string>('app.frontendUrl') ||
      'http://localhost:3000';
    return configured.trim().replace(/\/+$/, '');
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

  /**
   * Opt-in only — triggered by an explicit, off-by-default "Also email these
   * credentials to the user" checkbox at provisioning/reset time. Never sent
   * automatically. Puts the plaintext temporary password in the body, which is a
   * real tradeoff (a password sitting in an inbox), so this is deliberately not
   * the default delivery path — the persistent on-screen panel is.
   */
  async sendCredentialsEmail(email: string, password: string, fullName: string) {
    const link = `${this.frontendUrl()}/login`;
    await this.mail.send(
      email,
      'Your iDICE ESO Portal account',
      this.renderHtmlTemplate(
        'Your account is ready',
        `Hi ${fullName}, an account has been created for you on the iDICE ESO Portal.<br /><br />` +
          `Email: <strong>${email}</strong><br />` +
          `Temporary password: <strong>${password}</strong><br /><br />` +
          `You'll be asked to verify your email and set up two-factor authentication the first time you sign in. ` +
          `For your security, please sign in and change this password as soon as possible, and do not forward this email.`,
        'Sign in',
        link,
      ),
    );
  }

  async sendEligibilityRejection(email: string, remarks: string) {
    await this.tryInApp(email, 'Application not successful', `Your application was not successful at the eligibility stage. Reason: ${remarks}`);
    await this.mail.send(
      email,
      'Application Update — iDICE ESO Portal',
      this.renderHtmlTemplate(
        'Application update',
        `Your application was not successful at the eligibility stage. Reason: ${remarks}`,
        'Review application status',
        `${this.frontendUrl()}/eso/dashboard`,
      ),
    );
  }

  async sendReworkRequested(email: string, notes: string[]) {
    await this.tryInApp(email, 'Action required', `Please review and resubmit your application. Notes: ${notes.join('; ')}`);
    await this.mail.send(
      email,
      'Action Required — iDICE ESO Application',
      this.renderHtmlTemplate(
        'Action required',
        `Please review and resubmit your application. Notes: ${notes.join('; ')}`,
        'Open application',
        `${this.frontendUrl()}/eso/dashboard`,
      ),
    );
  }

  async sendShortlistedNotification(email: string, scorePercent: number) {
    await this.tryInApp(email, 'You have been shortlisted', 'Your application has been shortlisted for the next stage.');
    await this.mail.send(
      email,
      'Application Shortlisted — iDICE ESO Portal',
      this.renderHtmlTemplate(
        'Your application has been shortlisted',
        `Your application scored ${scorePercent}% and has been shortlisted for local ecosystem validation.`,
        'View application',
        `${this.frontendUrl()}/eso/dashboard`,
      ),
    );
  }

  async sendMatchedNotification(email: string, institutionName: string) {
    await this.tryInApp(email, 'You have been matched', `Your organisation has been matched with ${institutionName}.`);
    await this.mail.send(
      email,
      'You have been matched — iDICE ESO Portal',
      this.renderHtmlTemplate(
        'Partner match confirmed',
        `Congratulations — your organisation has been matched to ${institutionName} as its Enterprise Support Organisation partner.`,
        'View application',
        `${this.frontendUrl()}/eso/dashboard`,
      ),
    );
  }

  async sendDisqualificationNotification(email: string, reason: string) {
    await this.tryInApp(email, 'Application update', `Your application was not successful. Reason: ${reason}`);
    await this.mail.send(
      email,
      'Application status — iDICE ESO Portal',
      this.renderHtmlTemplate(
        'Application status update',
        `Your application has been discontinued from the current selection cycle. Reason: ${reason}`,
        'View update',
        `${this.frontendUrl()}/eso/dashboard`,
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

  /** In-app inbox entries are best-effort: they must never block or fail the email. */
  private async tryInApp(email: string, title: string, message: string) {
    try {
      await this.inApp.createForEmail(email, title, message, '/eso/dashboard');
    } catch {
      return;
    }
  }

  /** Best-effort in-app notification for a known user (never throws). */
  async notifyUser(userId: string, title: string, message: string, href?: string) {
    try {
      await this.inApp.create(userId, title, message, href);
    } catch {
      return;
    }
  }

  /** Best-effort in-app notification for everyone holding a role (never throws). */
  async notifyRole(
    role: string,
    title: string,
    message: string,
    href?: string,
    scope: { state?: string } = {},
  ) {
    try {
      await this.inApp.createForRole(role, title, message, href, scope);
    } catch {
      return;
    }
  }

  async sendBeneficiaryAllocated(
    email: string,
    phone: string,
    referenceId: string,
    institutionName: string,
  ) {
    await this.mail.send(
      email,
      'You have been placed — iDICE Youth Programme',
      this.renderHtmlTemplate(
        'You have been placed',
        `Good news — your application (reference <strong>${referenceId}</strong>) has been accepted and you have been allocated to <strong>${institutionName}</strong>. ` +
          `The centre will contact you with your start date and next steps.`,
        'iDICE Youth Programme',
        this.frontendUrl(),
      ),
    );
    await this.sms.send(
      phone,
      `iDICE: You have been allocated to ${institutionName}. Reference ${referenceId}. The centre will contact you with next steps.`,
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
