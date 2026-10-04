import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

export type MailProviderType = 'console' | 'resend' | 'aws-ses' | 'sendgrid';

@Injectable()
export class MailProvider {
  private readonly logger = new Logger(MailProvider.name);

  constructor(private readonly configService: ConfigService) {}

  private resendClient?: Resend;

  async send(to: string, subject: string, body: string): Promise<void> {
    const env = this.configService.get<string>('app.env') || 'development';
    const provider = (this.configService.get<string>('mail.provider') ||
      (env === 'production' ? 'resend' : 'resend')) as MailProviderType;
    const fromAddress =
      this.configService.get<string>('mail.fromAddress') || 'noreply@localhost';

    if (env !== 'production') {
      this.logger.log(
        `[DEV EMAIL :: ${provider.toUpperCase()}] To: ${to} | Subject: ${subject}\n${body}`,
      );
      return;
    }

    switch (provider) {
      case 'console':
        this.logger.log(
          `[MAIL :: CONSOLE] To: ${to} | Subject: ${subject}\n${body}`,
        );
        return;
      case 'resend':
        await this.sendWithResend(to, subject, body, fromAddress);
        return;
      case 'aws-ses':
        await this.sendWithAwsSes(to, subject, body);
        return;
      case 'sendgrid':
        await this.sendWithSendgrid(to, subject, body, fromAddress);
        return;
      default:
        this.logger.warn(
          `Unsupported mail provider '${provider}'. Falling back to console logging.`,
        );
        this.logger.log(
          `[MAIL :: CONSOLE FALLBACK] To: ${to} | Subject: ${subject}\n${body}`,
        );
    }
  }

  private async sendWithResend(
    to: string,
    subject: string,
    body: string,
    fromAddress: string,
  ): Promise<void> {
    const apiKey = this.configService.get<string>('mail.apiKey') || '';

    if (!apiKey) {
      this.logger.warn(
        'MAIL_API_KEY is not configured for resend. Falling back to console logging.',
      );
      this.logger.log(
        `[MAIL :: CONSOLE FALLBACK] To: ${to} | Subject: ${subject}\n${body}`,
      );
      return;
    }
    const fromName =
      this.configService.get<string>('mail.MAIL_FROM_NAME') || 'iDICE Portal';

    // Reuse or initialize the Resend SDK instance
    if (!this.resendClient) {
      this.resendClient = new Resend(apiKey);
    }

    const { data, error } = await this.resendClient.emails.send({
      from: `${fromName} <${fromAddress}>`,
      to: [to],
      subject,
      html: body,
      text: this.stripHtml(body),
    });

    if (error) {
      this.logger.error(`Resend dispatch failed: ${error.message}`, error);
      throw new Error(`Resend mail send failed: ${error.message}`);
    }

    this.logger.log(`Email sent successfully via Resend. ID: ${data?.id}`);
  }

  private async sendWithAwsSes(
    to: string,
    subject: string,
    body: string,
    // fromAddress: string,
  ): Promise<void> {
    const region = this.configService.get<string>('aws.region') || 'us-east-1';
    const accessKeyId = this.configService.get<string>('aws.accessKeyId') || '';
    const secretAccessKey =
      this.configService.get<string>('aws.secretAccessKey') || '';

    if (!accessKeyId || !secretAccessKey) {
      this.logger.warn(
        'AWS SES credentials are not configured. Falling back to console logging.',
      );
      this.logger.log(
        `[MAIL :: CONSOLE FALLBACK] To: ${to} | Subject: ${subject}\n${body}`,
      );
      return;
    }

    this.logger.warn(
      `AWS SES mail provider is configured but not fully implemented for this runtime. Falling back to console logging. Region: ${region}`,
    );
    this.logger.log(
      `[MAIL :: CONSOLE FALLBACK] To: ${to} | Subject: ${subject}\n${body}`,
    );
  }

  private async sendWithSendgrid(
    to: string,
    subject: string,
    body: string,
    fromAddress: string,
  ): Promise<void> {
    const apiKey = this.configService.get<string>('mail.apiKey') || '';
    if (!apiKey) {
      this.logger.warn(
        'MAIL_API_KEY is not configured for SendGrid. Falling back to console logging.',
      );
      this.logger.log(
        `[MAIL :: CONSOLE FALLBACK] To: ${to} | Subject: ${subject}\n${body}`,
      );
      return;
    }

    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: to }] }],
        from: { email: fromAddress },
        subject,
        content: [{ type: 'text/html', value: body }],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `SendGrid mail send failed (${response.status}): ${errorText}`,
      );
    }
  }

  private stripHtml(value: string): string {
    return value
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
}
