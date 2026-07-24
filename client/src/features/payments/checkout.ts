import { api } from '../../lib/api';

export interface CheckoutResult {
  free?: boolean;
  checkoutUrl?: string;
  reference: string;
}

/**
 * Starts a checkout; a 100%-off promo fulfills instantly (free: true),
 * otherwise the caller redirects the browser to the returned gateway URL.
 */
export async function startCheckout(params: {
  purpose: 'ceremony_creation' | 'download_unlock' | 'group_upgrade';
  ceremonyId?: string;
  groupId?: string;
  currency: 'NGN' | 'USD';
  promoCode?: string;
}): Promise<CheckoutResult> {
  return api<CheckoutResult>('/api/payments/checkout', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}
