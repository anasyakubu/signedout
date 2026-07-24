import { PaymentProvider } from './PaymentProvider.interface';
import { PaystackProvider } from './PaystackProvider';
import { FlutterwaveProvider } from './FlutterwaveProvider';

class PaymentRegistry {
  private providers = new Map<string, PaymentProvider>();

  register(name: string, provider: PaymentProvider) {
    this.providers.set(name, provider);
  }

  has(name: string): boolean {
    return this.providers.has(name);
  }

  get(name: string): PaymentProvider {
    const p = this.providers.get(name);
    if (!p) {
      throw new Error(
        `Payment gateway "${name}" is not configured on this server (missing API keys).`
      );
    }
    return p;
  }
}

export const paymentRegistry = new PaymentRegistry();

// Providers only register when their keys exist, so an unconfigured gateway
// fails loudly at checkout instead of silently faking a response.
if (process.env.PAYSTACK_SECRET_KEY) {
  paymentRegistry.register('paystack', new PaystackProvider(process.env.PAYSTACK_SECRET_KEY));
}
if (process.env.FLUTTERWAVE_SECRET_KEY) {
  paymentRegistry.register(
    'flutterwave',
    new FlutterwaveProvider(
      process.env.FLUTTERWAVE_SECRET_KEY,
      process.env.FLUTTERWAVE_WEBHOOK_HASH ?? ''
    )
  );
}
