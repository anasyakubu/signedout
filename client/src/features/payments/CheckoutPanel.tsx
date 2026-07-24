import { useState } from 'react';
import { Button, Field, FormError } from '../../components/ui';
import { ApiError } from '../../lib/api';
import { PaymentRequiredInfo } from '../../lib/types';
import { startCheckout } from './checkout';

interface Props {
  info: PaymentRequiredInfo;
  ceremonyId?: string;
  groupId?: string;
  heading: string;
  onFreeSuccess: () => void;
  onCancel?: () => void;
}

/** Inline checkout: currency choice, promo code, then off to the gateway. */
export default function CheckoutPanel({
  info,
  ceremonyId,
  groupId,
  heading,
  onFreeSuccess,
  onCancel,
}: Props) {
  const [currency, setCurrency] = useState<'NGN' | 'USD'>('NGN');
  const [promoCode, setPromoCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const price = info.pricing[currency];

  async function pay() {
    setError(null);
    setBusy(true);
    try {
      const result = await startCheckout({
        purpose: info.purpose,
        ceremonyId,
        groupId,
        currency,
        promoCode: promoCode.trim() || undefined,
      });
      if (result.free) {
        onFreeSuccess();
        return;
      }
      if (result.checkoutUrl) {
        window.location.href = result.checkoutUrl;
        return;
      }
      setError('The payment could not be started. Try again.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'The payment could not be started.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="border border-line bg-white p-6">
      <h3 className="font-display text-lg text-ink">{heading}</h3>
      <span className="signature-line mt-3" />
      <div className="mt-5 flex gap-2">
        {(['NGN', 'USD'] as const).map((c) => (
          <button
            key={c}
            onClick={() => setCurrency(c)}
            className={`border px-4 py-2 text-sm font-semibold ${
              currency === c
                ? 'border-laurel bg-laurel text-white'
                : 'border-line text-ink hover:border-laurel'
            }`}
          >
            {c === 'NGN' ? `NGN ${info.pricing.NGN.toLocaleString()}` : `USD ${info.pricing.USD}`}
          </button>
        ))}
      </div>
      <div className="mt-4">
        <Field
          label="Promo code (optional)"
          value={promoCode}
          onChange={(e) => setPromoCode(e.target.value)}
          placeholder="e.g. SO-4F2A1B"
        />
      </div>
      <div className="mt-4 space-y-3">
        <FormError message={error} />
        <div className="flex gap-3">
          <Button onClick={pay} disabled={busy}>
            {busy ? 'Starting payment' : `Pay ${currency} ${price.toLocaleString()}`}
          </Button>
          {onCancel && (
            <Button variant="secondary" onClick={onCancel}>
              Not now
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
