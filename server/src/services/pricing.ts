import { HttpError } from '../middleware/errorHandler';
import { PromoCode } from '../models/PromoCode';
import { ISiteSettings } from '../models/SiteSettings';
import { TxPurpose } from '../models/Transaction';

const PRICE_KEY: Record<TxPurpose, keyof ISiteSettings['pricing']> = {
  ceremony_creation: 'ceremonyCreation',
  download_unlock: 'designDownload',
  group_upgrade: 'groupUpgrade',
};

export function basePrice(
  settings: ISiteSettings,
  purpose: TxPurpose,
  currency: 'NGN' | 'USD'
): number {
  return settings.pricing[PRICE_KEY[purpose]][currency];
}

export async function applyPromo(
  amount: number,
  currency: 'NGN' | 'USD',
  purpose: TxPurpose,
  code?: string
): Promise<{ amount: number; promo?: string }> {
  if (!code) return { amount };
  const promo = await PromoCode.findOne({ code: code.toUpperCase().trim() });
  if (!promo || !promo.isActive) throw new HttpError(400, 'That promo code is not valid.');
  if (promo.expiresAt && promo.expiresAt < new Date()) {
    throw new HttpError(400, 'That promo code has expired.');
  }
  if (promo.maxUses && promo.usedCount >= promo.maxUses) {
    throw new HttpError(400, 'That promo code has reached its usage limit.');
  }
  if (promo.applicablePurposes.length && !promo.applicablePurposes.includes(purpose)) {
    throw new HttpError(400, 'That promo code does not apply to this purchase.');
  }
  let discounted: number;
  if (promo.discountType === 'percent') {
    discounted = amount * (1 - Math.min(promo.discountValue, 100) / 100);
  } else {
    if (promo.currency && promo.currency !== currency) {
      throw new HttpError(400, `That promo code only applies to ${promo.currency} payments.`);
    }
    discounted = amount - promo.discountValue;
  }
  return { amount: Math.max(0, Math.round(discounted * 100) / 100), promo: promo.code };
}

export async function consumePromo(code?: string): Promise<void> {
  if (!code) return;
  await PromoCode.updateOne({ code }, { $inc: { usedCount: 1 } });
}
