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
        throw new Error('WhatsApp not configured in production — set WHATSAPP_TOKEN and WHATSAPP_PHONE_ID');
      }
      console.log(`[DEV] OTP for ${recipientPhone}: ${otp}`);
      return;
    }

    // Normalize phone: ensure 91 prefix, no +
    const normalized = recipientPhone.startsWith('91')
      ? recipientPhone
      : `91${recipientPhone}`;

    const url = `https://graph.facebook.com/v18.0/${this.phoneId}/messages`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: normalized,
        type: 'template',
        template: {
          name: 'otp_verification',
          language: { code: 'en' },
          components: [
            {
              type: 'body',
              parameters: [{ type: 'text', text: otp }],
            },
          ],
        },
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error(`[WhatsApp] Failed to send OTP: ${res.status} ${body}`);
      throw new Error(`WhatsApp API error: ${res.status}`);
    }
  }
}
