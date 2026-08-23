import { Injectable } from '@nestjs/common';

@Injectable()
export class WhatsAppService {
  private token: string | null;
  private phoneId: string | null;

  constructor() {
    this.token = process.env.WHATSAPP_TOKEN || null;
    this.phoneId = process.env.WHATSAPP_PHONE_ID || null;
  }

  async sendOtp(recipientPhone: string, otp: string): Promise<void> {
    // Dev fallback -- log to console if WhatsApp not configured
    if (!this.token || !this.phoneId) {
      if (process.env.NODE_ENV === 'production') {
        throw new Error(
          'WhatsApp not configured in production — set WHATSAPP_TOKEN and WHATSAPP_PHONE_ID',
        );
      }
      console.log(`[DEV] OTP for ${recipientPhone}: ${otp}`);
      return;
    }

    await this.postTemplate(recipientPhone, 'otp_verification', [otp], 'OTP');
  }

  /**
   * P5a SHIP-05 — a parameterised template send (shipment updates, and any
   * later transactional template). Same Graph API call as {@link sendOtp}.
   *
   * Unlike `sendOtp` this never throws when WhatsApp is unconfigured: its
   * callers are notification side-effects of a committed write, so a missing
   * credential must degrade to a log line rather than surface as an error.
   */
  async sendTemplate(
    recipientPhone: string,
    templateName: string,
    bodyParams: string[] = [],
  ): Promise<void> {
    if (!this.token || !this.phoneId) {
      console.log(
        `[DEV] WhatsApp template "${templateName}" for ${recipientPhone}: ${bodyParams.join(' | ')}`,
      );
      return;
    }

    await this.postTemplate(
      recipientPhone,
      templateName,
      bodyParams,
      `template ${templateName}`,
    );
  }

  /** Normalize phone: ensure 91 prefix, no + */
  private normalize(recipientPhone: string): string {
    return recipientPhone.startsWith('91')
      ? recipientPhone
      : `91${recipientPhone}`;
  }

  private async postTemplate(
    recipientPhone: string,
    templateName: string,
    bodyParams: string[],
    label: string,
  ): Promise<void> {
    const url = `https://graph.facebook.com/v18.0/${this.phoneId}/messages`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: this.normalize(recipientPhone),
        type: 'template',
        template: {
          name: templateName,
          language: { code: 'en' },
          components: [
            {
              type: 'body',
              parameters: bodyParams.map((text) => ({ type: 'text', text })),
            },
          ],
        },
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error(
        `[WhatsApp] Failed to send ${label}: ${res.status} ${body}`,
      );
      throw new Error(`WhatsApp API error: ${res.status}`);
    }
  }
}
