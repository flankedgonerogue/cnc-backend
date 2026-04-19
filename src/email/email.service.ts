import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

@Injectable()
export class EmailService {
  private transporter: Transporter;
  private readonly logger = new Logger(EmailService.name);
  private fromEmail: string;

  constructor(private configService: ConfigService) {
    this.initializeTransporter();
    this.fromEmail = this.configService.get<string>(
      'MAIL_FROM_EMAIL',
      'noreply@chroniclesandconversations.com',
    );
  }

  private initializeTransporter() {
    const emailProvider = this.configService.get<string>(
      'EMAIL_PROVIDER',
      'smtp',
    );

    if (emailProvider === 'aws-ses') {
      this.initializeAwsSesTransporter();
    } else {
      this.initializeSmtpTransporter();
    }
  }

  private initializeSmtpTransporter() {
    const host = this.configService.get<string>('SMTP_HOST');
    const port = this.configService.get<number>('SMTP_PORT', 587);
    const user = this.configService.get<string>('SMTP_USER');
    const pass = this.configService.get<string>('SMTP_PASSWORD');
    const secure = this.configService.get<boolean>('SMTP_SECURE', false);

    if (!host || !user || !pass) {
      this.logger.warn(
        'SMTP configuration incomplete. Email sending may not work.',
      );
    }

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: user && pass ? { user, pass } : undefined,
    });

    this.logger.log('SMTP transporter initialized');
  }

  private initializeAwsSesTransporter() {
    // AWS SES configuration would go here
    // For now, fallback to SMTP
    this.logger.warn('AWS SES not yet implemented, using SMTP fallback');
    this.initializeSmtpTransporter();
  }

  /**
   * Send password reset email
   */
  async sendPasswordResetEmail(
    email: string,
    resetToken: string,
    resetUrl: string,
  ): Promise<void> {
    const htmlContent = this.getPasswordResetEmailTemplate(resetUrl);

    try {
      await this.transporter.sendMail({
        from: this.fromEmail,
        to: email,
        subject: 'Reset Your Chronicles N Conversations Password',
        html: htmlContent,
        text: this.getPasswordResetEmailText(resetUrl),
      });

      this.logger.log(`Password reset email sent to ${email}`);
    } catch (error) {
      this.logger.error(
        `Failed to send password reset email to ${email}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Send email verification email (for future use)
   */
  async sendVerificationEmail(
    email: string,
    verificationUrl: string,
  ): Promise<void> {
    const htmlContent = this.getVerificationEmailTemplate(verificationUrl);

    try {
      await this.transporter.sendMail({
        from: this.fromEmail,
        to: email,
        subject: 'Verify Your Chronicles N Conversations Email',
        html: htmlContent,
        text: this.getVerificationEmailText(verificationUrl),
      });

      this.logger.log(`Verification email sent to ${email}`);
    } catch (error) {
      this.logger.error(
        `Failed to send verification email to ${email}:`,
        error,
      );
      throw error;
    }
  }

  async sendGuardianPairingEmail(
    email: string,
    pairingUrl: string,
    expiresAt: Date,
  ): Promise<void> {
    const htmlContent = this.getGuardianPairingEmailTemplate(pairingUrl, expiresAt);
    const textContent = this.getGuardianPairingEmailText(pairingUrl, expiresAt);

    try {
      await this.transporter.sendMail({
        from: this.fromEmail,
        to: email,
        subject: 'Guardian Pairing Request - Chronicles N Conversations',
        html: htmlContent,
        text: textContent,
      });

      this.logger.log(`Guardian pairing email sent to ${email}`);
    } catch (error) {
      this.logger.error(
        `Failed to send guardian pairing email to ${email}:`,
        error,
      );
      throw error;
    }
  }

  private getPasswordResetEmailTemplate(resetUrl: string): string {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Your Password - Chronicles N Conversations</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      background: linear-gradient(to bottom, rgb(239 246 255), rgb(255 255 255), rgb(239 246 255));
      margin: 0;
      padding: 20px;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      background: white;
      border-radius: 12px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
      overflow: hidden;
    }
    .header {
      background: linear-gradient(to right, #2563eb, #9333ea);
      color: white;
      padding: 40px 20px;
      text-align: center;
    }
    .header h1 {
      margin: 0;
      font-size: 24px;
      font-weight: bold;
      letter-spacing: -0.5px;
    }
    .header p {
      margin: 8px 0 0 0;
      font-size: 14px;
      opacity: 0.95;
    }
    .content {
      padding: 40px 30px;
    }
    .greeting {
      font-size: 16px;
      margin-bottom: 20px;
      color: #1f2937;
    }
    .message {
      font-size: 14px;
      line-height: 1.8;
      color: #4b5563;
      margin-bottom: 30px;
    }
    .warning {
      background-color: #fef3c7;
      border-left: 4px solid #f59e0b;
      padding: 12px 15px;
      margin: 20px 0;
      border-radius: 4px;
      font-size: 13px;
      color: #92400e;
    }
    .cta-section {
      text-align: center;
      margin: 30px 0;
    }
    .cta-button {
      display: inline-block;
      background: linear-gradient(to right, #2563eb, #1d4ed8);
      color: white;
      padding: 12px 32px;
      text-decoration: none;
      border-radius: 8px;
      font-weight: 600;
      font-size: 15px;
      transition: all 0.3s ease;
      box-shadow: 0 2px 8px rgba(37, 99, 235, 0.2);
    }
    .cta-button:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);
    }
    .fallback-link {
      margin-top: 20px;
      padding-top: 20px;
      border-top: 1px solid #e5e7eb;
      text-align: center;
    }
    .fallback-link p {
      margin: 0 0 8px 0;
      font-size: 13px;
      color: #6b7280;
    }
    .fallback-link a {
      display: block;
      color: #2563eb;
      text-decoration: none;
      word-break: break-all;
      font-size: 12px;
      margin-top: 5px;
    }
    .footer {
      background-color: #f9fafb;
      padding: 20px 30px;
      border-top: 1px solid #e5e7eb;
      font-size: 12px;
      color: #6b7280;
      text-align: center;
    }
    .footer p {
      margin: 5px 0;
    }
    .feature-list {
      background-color: #f0f9ff;
      border-radius: 8px;
      padding: 15px 20px;
      margin: 20px 0;
      border-left: 4px solid #0ea5e9;
    }
    .feature-list li {
      margin: 8px 0;
      font-size: 13px;
      color: #0c4a6e;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎭 Chronicles N Conversations</h1>
      <p>Extending Behavioral Reinforcement Through Storytelling</p>
    </div>

    <div class="content">
      <p class="greeting">Hi there,</p>

      <p class="message">
        We received a request to reset the password for your Chronicles N Conversations account. 
        If you didn't make this request, you can safely ignore this email—your account remains secure.
      </p>

      <div class="cta-section">
        <a href="${resetUrl}" class="cta-button">Reset Your Password</a>
      </div>

      <div class="warning">
        ⏱️ <strong>This link expires in 1 hour.</strong> If you don't reset your password within that time, 
        you'll need to request a new password reset link.
      </div>

      <p class="message">
        Once you reset your password, you'll be able to:
      </p>

      <ul class="feature-list">
        <li>✨ Access personalized therapeutic stories for your child</li>
        <li>📊 Track progress and behavioral insights</li>
        <li>🎯 Collaborate with therapists on treatment goals</li>
        <li>🔐 Keep your account secure with a strong password</li>
      </ul>

      <p class="message">
        <strong>Need help?</strong> If you have any questions or didn't request this email, 
        please contact our support team or reply to this message.
      </p>

      <div class="fallback-link">
        <p>If the button above doesn't work, copy and paste this link into your browser:</p>
        <a href="${resetUrl}">${resetUrl}</a>
      </div>
    </div>

    <div class="footer">
      <p>© 2026 Chronicles N Conversations. All rights reserved.</p>
      <p>We're committed to providing a safe, COPPA-compliant platform for child therapy.</p>
      <p style="margin-top: 10px; color: #9ca3af;">
        <a href="#" style="color: #6b7280; text-decoration: none;">Privacy Policy</a> | 
        <a href="#" style="color: #6b7280; text-decoration: none;">Terms of Service</a>
      </p>
    </div>
  </div>
</body>
</html>
    `;
  }

  private getPasswordResetEmailText(resetUrl: string): string {
    return `
Chronicles N Conversations - Reset Your Password

Hi there,

We received a request to reset the password for your Chronicles N Conversations account. 
If you didn't make this request, you can safely ignore this email—your account remains secure.

To reset your password, click the link below or copy and paste it into your browser:
${resetUrl}

IMPORTANT: This link expires in 1 hour. If you don't reset your password within that time, 
you'll need to request a new password reset link.

Once you reset your password, you'll be able to:
- Access personalized therapeutic stories for your child
- Track progress and behavioral insights
- Collaborate with therapists on treatment goals
- Keep your account secure with a strong password

Need help? Contact our support team or reply to this message.

© 2026 Chronicles N Conversations. All rights reserved.
We're committed to providing a safe, COPPA-compliant platform for child therapy.
    `;
  }

  private getVerificationEmailTemplate(verificationUrl: string): string {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verify Your Email - Chronicles N Conversations</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      background: linear-gradient(to bottom, rgb(239 246 255), rgb(255 255 255), rgb(239 246 255));
      margin: 0;
      padding: 20px;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      background: white;
      border-radius: 12px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
      overflow: hidden;
    }
    .header {
      background: linear-gradient(to right, #2563eb, #9333ea);
      color: white;
      padding: 40px 20px;
      text-align: center;
    }
    .header h1 {
      margin: 0;
      font-size: 24px;
      font-weight: bold;
    }
    .content {
      padding: 40px 30px;
    }
    .greeting {
      font-size: 16px;
      margin-bottom: 20px;
    }
    .message {
      font-size: 14px;
      line-height: 1.8;
      color: #4b5563;
      margin-bottom: 30px;
    }
    .cta-section {
      text-align: center;
      margin: 30px 0;
    }
    .cta-button {
      display: inline-block;
      background: linear-gradient(to right, #2563eb, #1d4ed8);
      color: white;
      padding: 12px 32px;
      text-decoration: none;
      border-radius: 8px;
      font-weight: 600;
      font-size: 15px;
    }
    .footer {
      background-color: #f9fafb;
      padding: 20px 30px;
      border-top: 1px solid #e5e7eb;
      font-size: 12px;
      color: #6b7280;
      text-align: center;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎭 Chronicles N Conversations</h1>
    </div>
    <div class="content">
      <p class="greeting">Welcome!</p>
      <p class="message">
        Please verify your email address to complete your registration and start creating therapeutic stories.
      </p>
      <div class="cta-section">
        <a href="${verificationUrl}" class="cta-button">Verify Email</a>
      </div>
    </div>
    <div class="footer">
      <p>© 2026 Chronicles N Conversations</p>
    </div>
  </div>
</body>
</html>
    `;
  }

  private getVerificationEmailText(verificationUrl: string): string {
    return `
Chronicles N Conversations - Verify Your Email

Welcome!

Please verify your email address to complete your registration and start creating therapeutic stories.

${verificationUrl}

© 2026 Chronicles N Conversations
    `;
  }

  private getGuardianPairingEmailTemplate(
    pairingUrl: string,
    expiresAt: Date,
  ): string {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Guardian Pairing Request - Chronicles N Conversations</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #1f2937;">
  <h2>Guardian Pairing Request</h2>
  <p>A guardian has requested to pair with this child profile.</p>
  <p>To approve the pairing, click this link:</p>
  <p><a href="${pairingUrl}">${pairingUrl}</a></p>
  <p>This link expires on <strong>${expiresAt.toISOString()}</strong>.</p>
  <p>If you did not expect this, you can safely ignore this email.</p>
</body>
</html>
    `;
  }

  private getGuardianPairingEmailText(
    pairingUrl: string,
    expiresAt: Date,
  ): string {
    return `
Guardian Pairing Request - Chronicles N Conversations

A guardian has requested to pair with this child profile.

Approve pairing:
${pairingUrl}

This link expires on ${expiresAt.toISOString()}.
If you did not expect this, ignore this message.
    `;
  }

  /**
   * Verify transporter connection (useful for health checks)
   */
  async verify(): Promise<boolean> {
    try {
      await this.transporter.verify();
      this.logger.log('Email transporter verified successfully');
      return true;
    } catch (error) {
      this.logger.error('Email transporter verification failed:', error);
      return false;
    }
  }
}
