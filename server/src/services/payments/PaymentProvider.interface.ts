export interface InitializeParams {
  amount: number; // major units (naira, dollars)
  currency: 'NGN' | 'USD';
  email: string;
  reference: string;
  callbackUrl: string;
  metadata: Record<string, unknown>;
}

export interface PaymentProvider {
  initialize(params: InitializeParams): Promise<{ checkoutUrl: string; reference: string }>;
  verify(reference: string): Promise<{ status: 'success' | 'failed' | 'pending'; amount: number }>;
  verifyWebhookSignature(rawBody: Buffer, headers: Record<string, string | string[] | undefined>): boolean;
  /** Extract our transaction reference + status from a webhook payload. */
  parseWebhook(rawBody: Buffer): { reference: string; status: 'success' | 'failed' } | null;
}
