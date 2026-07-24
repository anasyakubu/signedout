import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';
import { Wordmark } from '../components/ui';

type State = 'checking' | 'success' | 'failed' | 'pending';

/**
 * Gateways redirect here after payment. We confirm server-side via the verify
 * endpoint (which itself re-checks with the gateway), polling briefly because
 * settlement can lag the redirect by a few seconds.
 */
export default function PayCallback() {
  const [params] = useSearchParams();
  const reference = params.get('reference') ?? params.get('tx_ref') ?? '';
  const [state, setState] = useState<State>('checking');
  const attempts = useRef(0);

  useEffect(() => {
    if (!reference) {
      setState('failed');
      return;
    }
    let stopped = false;
    async function poll() {
      if (stopped) return;
      attempts.current += 1;
      try {
        const d = await api<{ status: 'success' | 'failed' | 'pending' }>(
          `/api/payments/verify/${reference}`
        );
        if (d.status === 'success') return setState('success');
        if (d.status === 'failed') return setState('failed');
      } catch {
        // fall through to retry
      }
      if (attempts.current >= 6) return setState('pending');
      setTimeout(poll, 2500);
    }
    poll();
    return () => {
      stopped = true;
    };
  }, [reference]);

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col items-center px-6 pt-24 text-center">
      <Wordmark />
      <div className="mt-12 w-full border border-line bg-white p-8">
        {state === 'checking' && (
          <>
            <h1 className="font-display text-xl text-ink">Confirming your payment</h1>
            <p className="mt-2 text-sm text-stone">This usually takes a few seconds.</p>
          </>
        )}
        {state === 'success' && (
          <>
            <h1 className="font-display text-xl text-laurel-dark">Payment confirmed</h1>
            <p className="mt-2 text-sm text-stone">
              Your unlock has been applied to your account.
            </p>
          </>
        )}
        {state === 'failed' && (
          <>
            <h1 className="font-display text-xl text-danger">Payment not completed</h1>
            <p className="mt-2 text-sm text-stone">
              No charge was applied. You can try again from where you started.
            </p>
          </>
        )}
        {state === 'pending' && (
          <>
            <h1 className="font-display text-xl text-ink">Still settling</h1>
            <p className="mt-2 text-sm text-stone">
              The gateway has not confirmed yet. If you were charged, the unlock will apply
              automatically once the webhook lands.
            </p>
          </>
        )}
        <Link to="/dashboard" className="mt-6 inline-block text-sm font-semibold text-laurel">
          Back to your dashboard
        </Link>
      </div>
    </div>
  );
}
