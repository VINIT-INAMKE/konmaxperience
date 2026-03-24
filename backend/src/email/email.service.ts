import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MailerSend, EmailParams, Sender, Recipient } from 'mailersend';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private mailerSend: MailerSend;
  private fromEmail: string;
  private frontendUrl: string;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('MAILERSEND_API_KEY') || '';
    this.mailerSend = new MailerSend({ apiKey });
    this.fromEmail =
      this.configService.get<string>('MAILERSEND_FROM_EMAIL') ||
      'noreply@konma.store';
    this.frontendUrl =
      this.configService.get<string>('FRONTEND_URL') ||
      'http://localhost:3000';
  }

  private get emailDisabled(): boolean {
    return this.configService.get<string>('EMAIL_DISABLED') === 'true';
  }

  async sendPasswordSetup(
    email: string,
    token: string,
    userName: string,
  ): Promise<void> {
    if (this.emailDisabled) { this.logger.log(`[EMAIL DISABLED] Skipping password setup email to ${email}`); return; }
    try {
      const sentFrom = new Sender(this.fromEmail, 'Konma Xperience');
      const recipients = [new Recipient(email, userName)];
      const setupLink = `${this.frontendUrl}/set-password?token=${token}`;

      const emailParams = new EmailParams()
        .setFrom(sentFrom)
        .setTo(recipients)
        .setSubject('Set up your Konma Xperience password')
        .setHtml(
          `<p>Hi ${userName},</p>` +
            `<p>Your Konma Xperience account has been created. Please set your password by clicking the link below:</p>` +
            `<p><a href="${setupLink}">Set Your Password</a></p>` +
            `<p>This link expires in 15 minutes.</p>` +
            `<p>If you did not expect this email, you can safely ignore it.</p>` +
            `<p>-- Konma Xperience Team</p>`,
        )
        .setText(
          `Hi ${userName},\n\n` +
            `Your Konma Xperience account has been created. Please set your password by visiting:\n\n` +
            `${setupLink}\n\n` +
            `This link expires in 15 minutes.\n\n` +
            `-- Konma Xperience Team`,
        );

      await this.mailerSend.email.send(emailParams);
      this.logger.log(`Password setup email sent to ${email}`);
    } catch (error) {
      // Email failure should not block account creation
      this.logger.error(
        `Failed to send password setup email to ${email}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  async sendHtml(
    to: { email: string; name: string },
    subject: string,
    html: string,
    text: string,
  ): Promise<void> {
    if (this.emailDisabled) { this.logger.log(`[EMAIL DISABLED] Skipping email to ${to.email}: ${subject}`); return; }
    try {
      const sentFrom = new Sender(this.fromEmail, 'Konma Xperience');
      const recipients = [new Recipient(to.email, to.name)];

      const emailParams = new EmailParams()
        .setFrom(sentFrom)
        .setTo(recipients)
        .setSubject(subject)
        .setHtml(html)
        .setText(text);

      await this.mailerSend.email.send(emailParams);
      this.logger.log(`Email sent to ${to.email}: ${subject}`);
    } catch (error) {
      this.logger.error(
        `Failed to send email to ${to.email}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }
  }

  get publicFrontendUrl(): string {
    return this.frontendUrl;
  }

  async sendPasswordReset(
    email: string,
    token: string,
    userName: string,
  ): Promise<void> {
    if (this.emailDisabled) { this.logger.log(`[EMAIL DISABLED] Skipping password reset email to ${email}`); return; }
    try {
      const sentFrom = new Sender(this.fromEmail, 'Konma Xperience');
      const recipients = [new Recipient(email, userName)];
      const resetLink = `${this.frontendUrl}/reset-password?token=${token}`;

      const emailParams = new EmailParams()
        .setFrom(sentFrom)
        .setTo(recipients)
        .setSubject('Reset your Konma Xperience password')
        .setHtml(
          `<p>Hi ${userName},</p>` +
            `<p>A password reset was requested for your Konma Xperience account. Click the link below to reset your password:</p>` +
            `<p><a href="${resetLink}">Reset Your Password</a></p>` +
            `<p>This link expires in 15 minutes.</p>` +
            `<p>If you did not request this, you can safely ignore this email.</p>` +
            `<p>-- Konma Xperience Team</p>`,
        )
        .setText(
          `Hi ${userName},\n\n` +
            `A password reset was requested for your Konma Xperience account. Visit the link below to reset your password:\n\n` +
            `${resetLink}\n\n` +
            `This link expires in 15 minutes.\n\n` +
            `-- Konma Xperience Team`,
        );

      await this.mailerSend.email.send(emailParams);
      this.logger.log(`Password reset email sent to ${email}`);
    } catch (error) {
      // Email failure should not block password reset flow
      this.logger.error(
        `Failed to send password reset email to ${email}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
