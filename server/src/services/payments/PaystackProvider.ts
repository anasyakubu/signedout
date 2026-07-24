import crypto from 'crypto';
import { PaymentProvider, InitializeParams } from './PaymentProvider.interface';

// API shapes per Paystack docs at build time — re-verify against
// https://paystack.com/docs/api if requests start failing.
const BASE = 'https://api.paystack.co';

export class PaystackProvider implements PaymentProvider {
  constructor(private secretKey: string) {}

  private headers() {
    return {
      Authorization: `Bearer ${this.secretKey}`,
      'Content-Type': 'application/json',
    };
  }

  async initialize(params: InitializeParams) {
    const res = await fetch(`${BASE}/transaction/initialize`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({
        email: params.email,
        amount: Math.round(params.amount * 100), // kobo / cents
        currency: params.currency,
        reference: params.reference,
        callback_url: params.callbackUrl,
        metadata: params.metadata,
      }),
    });
    const body = (await res.json()) as {
      status: boolean;
      message: string;
      data?: { authorization_url: string; reference: string };
    };
    if (!res.ok || !body.status || !body.data) {
      throw new Error(`Paystack initialize failed: ${body.message ?? res.status}`);
    }
    return { checkoutUrl: body.data.authorization_url, reference: body.data.reference };
  }

  async verify(reference: string) {
    const res = await fetch(`${BASE}/transaction/verify/${encodeURIComponent(reference)}`, {
      headers: this.headers(),
    });
    const body = (await res.json()) as {
      status: boolean;
      data?: { status: string; amount: number };
    };
    if (!res.ok || !body.status || !body.data) return { status: 'pending' as const, amount: 0 };
    const status =
      body.data.status === 'success'
        ? ('success' as const)
        : body.data.status === 'failed' || body.data.status === 'abandoned'
          ? ('failed' as const)
          : ('pending' as const);
    return { status, amount: body.data.amount / 100 };
  }

  verifyWebhookSignature(rawBody: Buffer, headers: Record<string, string | string[] | undefined>) {
    const sig = headers['x-paystack-signature'];
    if (typeof sig !== 'string') return false;
    const expected = crypto.createHmac('sha512', this.secretKey).update(rawBody).digest('hex');
    return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  }

  parseWebhook(rawBody: Buffer) {
    try {
      const event = JSON.parse(rawBody.toString('utf8')) as {
        event: string;
        data?: { reference?: string };
      };
      if (!event.data?.reference) return null;
      if (event.event === 'charge.success') {
        return { reference: event.data.reference, status: 'success' as const };
      }
      if (event.event === 'charge.failed') {
        return { reference: event.data.reference, status: 'failed' as const };
      }
      return null;
    } catch {
      return null;
    }
  }
}
