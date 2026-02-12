import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

interface StoredOtp {
  code: string;
  expiresAt: number;
  attempts: number;
}

@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);
  private readonly store = new Map<string, StoredOtp>();
  private readonly OTP_LENGTH = 6;
  private readonly OTP_TTL_MS = 5 * 60 * 1000; // 5 minutes
  private readonly MAX_ATTEMPTS = 5;
  private resend: Resend | null = null;
  private readonly fromEmail: string;

  constructor(private configService: ConfigService) {
    const resendKey = this.configService.get<string>('RESEND_API_KEY');
    if (resendKey) {
      this.resend = new Resend(resendKey);
      this.logger.log('Resend email client initialized');
    } else {
      this.logger.warn('RESEND_API_KEY not set — emails will be logged to console only');
    }

    this.fromEmail = this.configService.get<string>('OTP_FROM_EMAIL', 'Si <noreply@sisendsmoney.com>');

    // Clean up expired OTPs every 60 seconds
    setInterval(() => this.cleanup(), 60_000);
  }

  /**
   * Generate and store an OTP for a given key (email or phone)
   */
  async sendOtp(key: string, type: 'email' | 'phone'): Promise<{ success: boolean; message: string }> {
    const code = this.generateCode();
    const storeKey = `${type}:${key}`;

    this.store.set(storeKey, {
      code,
      expiresAt: Date.now() + this.OTP_TTL_MS,
      attempts: 0,
    });

    if (type === 'email') {
      await this.sendEmailOtp(key, code);
    } else {
      // Phone OTP — no SMS provider yet, log only
      this.logger.log(`[SMS] OTP for ${key}: ${code}`);
    }

    return {
      success: true,
      message: type === 'email'
        ? `Verification code sent to ${key}`
        : `Verification code sent to ${key}`,
    };
  }

  /**
   * Verify an OTP code for a given key
   */
  async verifyOtp(key: string, code: string, type: 'email' | 'phone'): Promise<{ success: boolean; verified: boolean }> {
    const storeKey = `${type}:${key}`;
    const stored = this.store.get(storeKey);

    if (!stored) {
      throw new Error('No verification code found. Please request a new one.');
    }

    if (Date.now() > stored.expiresAt) {
      this.store.delete(storeKey);
      throw new Error('Verification code expired. Please request a new one.');
    }

    if (stored.attempts >= this.MAX_ATTEMPTS) {
      this.store.delete(storeKey);
      throw new Error('Too many attempts. Please request a new code.');
    }

    stored.attempts++;

    if (stored.code !== code) {
      throw new Error('Invalid verification code.');
    }

    // OTP verified successfully — remove it
    this.store.delete(storeKey);

    return { success: true, verified: true };
  }

  private async sendEmailOtp(email: string, code: string): Promise<void> {
    if (!this.resend) {
      this.logger.log(`[DEV] OTP for email ${email}: ${code}`);
      return;
    }

    try {
      await this.resend.emails.send({
        from: this.fromEmail,
        to: email,
        subject: `${code} is your Si verification code`,
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 24px;">
            <div style="text-align: center; margin-bottom: 32px;">
              <h1 style="color: #2D7A4E; font-size: 24px; margin: 0;">Si</h1>
            </div>
            <h2 style="color: #1a1a1a; font-size: 20px; margin-bottom: 8px;">Verification code</h2>
            <p style="color: #666; font-size: 15px; line-height: 1.5; margin-bottom: 24px;">
              Enter this code to verify your identity:
            </p>
            <div style="background: #F0F7F3; border-radius: 12px; padding: 20px; text-align: center; margin-bottom: 24px;">
              <span style="font-size: 32px; font-weight: 700; letter-spacing: 8px; color: #2D7A4E;">${code}</span>
            </div>
            <p style="color: #999; font-size: 13px; line-height: 1.5;">
              This code expires in 5 minutes. If you didn't request this, you can safely ignore this email.
            </p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
            <p style="color: #bbb; font-size: 12px; text-align: center;">
              Si Crypto &mdash; sisendsmoney.com
            </p>
          </div>
        `,
      });
      this.logger.log(`OTP email sent to ${email}`);
    } catch (error) {
      this.logger.error(`Failed to send OTP email to ${email}: ${error.message}`);
      // Still store the OTP so dev/testing can work via logs
      this.logger.log(`[FALLBACK] OTP for email ${email}: ${code}`);
    }
  }

  private generateCode(): string {
    const digits = '0123456789';
    let code = '';
    for (let i = 0; i < this.OTP_LENGTH; i++) {
      code += digits[Math.floor(Math.random() * digits.length)];
    }
    return code;
  }

  private cleanup() {
    const now = Date.now();
    for (const [key, otp] of this.store.entries()) {
      if (now > otp.expiresAt) {
        this.store.delete(key);
      }
    }
  }
}
