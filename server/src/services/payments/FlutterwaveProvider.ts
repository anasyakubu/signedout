import crypto from 'crypto';
import { PaymentProvider, InitializeParams } from './PaymentProvider.interface';

// API shapes per Flutterwave v3 docs at build time — re-verify against
// https://developer.flutterwave.com/docs if requests start failing.
const BASE = 'https://api.flutterwave.com/v3';

export class FlutterwaveProvider implements PaymentProvider {
  constructor(
    private secretKey: string,
    private webhookHash: string
  ) {}

  private headers() {
    return {
      Authorization: `Bearer ${this.secretKey}`,
      'Content-Type': 'application/json',
    };
  }

  async initialize(params: InitializeParams) {
    const res = await fetch(`${BASE}/payments`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({
        tx_ref: params.reference,
        amount: params.amount, // major units
        currency: params.currency,
        redirect_url: params.callbackUrl,
        customer: { email: params.email },
        meta: params.metadata,
        customizations: { title: 'SignedOut' },
      }),
    });
    const body = (await res.json()) as {
      status: string;
      message: string;
      data?: { link: string };
    };
    if (!res.ok || body.status !== 'success' || !body.data) {
      throw new Error(`Flutterwave initialize failed: ${body.message ?? res.status}`);
    }
    return { checkoutUrl: body.data.link, reference: params.reference };
  }

  async verify(reference: string) {
    const res = await fetch(
      `${BASE}/transactions/verify_by_reference?tx_ref=${encodeURIComponent(reference)}`,
      { headers: this.headers() }
    );
    const body = (await res.json()) as {
      status: string;
      data?: { status: string; amount: number };
    };
    if (!res.ok || body.status !== 'success' || !body.data) {
      return { status: 'pending' as const, amount: 0 };
    }
    const status =
      body.data.status === 'successful'
        ? ('success' as const)
        : body.data.status === 'failed'
          ? ('failed' as const)
          : ('pending' as const);
    return { status, amount: body.data.amount };
  }

  verifyWebhookSignature(_rawBody: Buffer, headers: Record<string, string | string[] | undefined>) {
    // Flutterwave sends the account's configured secret hash verbatim in the
    // verif-hash header rather than an HMAC of the body.
    const sig = headers['verif-hash'];
    if (typeof sig !== 'string' || !this.webhookHash) return false;
    const a = Buffer.from(sig);
    const b = Buffer.from(this.webhookHash);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  }

  parseWebhook(rawBody: Buffer) {
    try {
      const event = JSON.parse(rawBody.toString('utf8')) as {
        event?: string;
        data?: { tx_ref?: string; status?: string };
      };
      const reference = event.data?.tx_ref;
      if (!reference) return null;
      if (event.data?.status === 'successful') return { reference, status: 'success' as const };
      if (event.data?.status === 'failed') return { reference, status: 'failed' as const };
      return null;
    } catch {
      return null;
    }
  }
}
