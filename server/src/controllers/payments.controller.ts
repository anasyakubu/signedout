import { Request, Response, NextFunction } from 'express';
import { Transaction, TxPurpose } from '../models/Transaction';
import { Ceremony } from '../models/Ceremony';
import { Group, memberRole } from '../models/Group';
import { User } from '../models/User';
import { getSettings } from '../models/SiteSettings';
import { HttpError } from '../middleware/errorHandler';
import { paymentRegistry } from '../services/payments/PaymentRegistry';
import { basePrice, applyPromo } from '../services/pricing';
import { fulfill } from '../services/fulfillment';
import { makeReference } from '../utils/slug';
import { env } from '../config/env';

export async function checkout(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.auth!.sub;
    const { purpose, ceremonyId, groupId, currency, promoCode } = req.body as {
      purpose: TxPurpose;
      ceremonyId?: string;
      groupId?: string;
      currency: 'NGN' | 'USD';
      promoCode?: string;
    };

    const settings = await getSettings();
    if (!settings.monetizationEnabled) {
      throw new HttpError(400, 'Monetization is currently off — this action is free.');
    }

    // Validate the thing being unlocked belongs to (or is editable by) the payer.
    if (purpose === 'download_unlock') {
      if (!ceremonyId) throw new HttpError(400, 'ceremonyId is required for a download unlock.');
      const ceremony = await Ceremony.findById(ceremonyId);
      if (!ceremony) throw new HttpError(404, 'Ceremony not found.');
      if (ceremony.isPaidTier) throw new HttpError(409, 'This download is already unlocked.');
    }
    if (purpose === 'group_upgrade') {
      if (!groupId) throw new HttpError(400, 'groupId is required for a group upgrade.');
      const group = await Group.findById(groupId);
      if (!group) throw new HttpError(404, 'Group not found.');
      if (memberRole(group, userId) !== 'owner') {
        throw new HttpError(403, 'Only the group owner can upgrade the group.');
      }
      if (group.upgraded) throw new HttpError(409, 'This group is already upgraded.');
    }

    const price = basePrice(settings, purpose, currency);
    if (!Number.isFinite(price) || price < 0) {
      throw new HttpError(500, 'Pricing for this action is not configured. Contact the admin.');
    }
    const { amount, promo } = await applyPromo(price, currency, purpose, promoCode);
    const user = await User.findById(userId);
    if (!user) throw new HttpError(404, 'Account not found.');

    const reference = makeReference(purpose.slice(0, 8));

    // A 100%-off promo skips the gateway entirely: record and fulfill now.
    if (amount <= 0) {
      const tx = await Transaction.create({
        userId,
        ceremonyId,
        groupId,
        purpose,
        amount: 0,
        currency,
        gateway: 'promo',
        gatewayReference: reference,
        status: 'pending',
        promoCodeUsed: promo,
      });
      await fulfill(tx);
      return res.json({ free: true, reference });
    }

    const gatewayName = settings.currencyRouting[currency];
    if (!settings.gateways[gatewayName]?.enabled) {
      throw new HttpError(503, `Payments in ${currency} are currently unavailable.`);
    }
    const provider = paymentRegistry.get(gatewayName);
    const { checkoutUrl } = await provider.initialize({
      amount,
      currency,
      email: user.email,
      reference,
      callbackUrl: `${env.clientUrl}/pay/callback?reference=${reference}`,
      metadata: { purpose, ceremonyId, groupId, userId },
    });

    await Transaction.create({
      userId,
      ceremonyId,
      groupId,
      purpose,
      amount,
      currency,
      gateway: gatewayName,
      gatewayReference: reference,
      status: 'pending',
      promoCodeUsed: promo,
    });
    res.json({ checkoutUrl, reference, amount, currency, gateway: gatewayName });
  } catch (err) {
    next(err);
  }
}

/** Client-side confirmation after gateway redirect (webhooks can't reach localhost). */
export async function verify(req: Request, res: Response, next: NextFunction) {
  try {
    const tx = await Transaction.findOne({ gatewayReference: req.params.reference });
    if (!tx) throw new HttpError(404, 'Transaction not found.');
    if (tx.userId.toString() !== req.auth!.sub && req.auth!.role !== 'admin') {
      throw new HttpError(403, 'This transaction belongs to another account.');
    }
    if (tx.status === 'success') return res.json({ status: 'success', purpose: tx.purpose });
    if (tx.gateway === 'promo') return res.json({ status: tx.status, purpose: tx.purpose });

    const provider = paymentRegistry.get(tx.gateway);
    const result = await provider.verify(tx.gatewayReference);
    if (result.status === 'success') {
      await fulfill(tx);
      return res.json({ status: 'success', purpose: tx.purpose });
    }
    if (result.status === 'failed') {
      tx.status = 'failed';
      await tx.save();
    }
    res.json({ status: result.status, purpose: tx.purpose });
  } catch (err) {
    next(err);
  }
}

function webhookHandler(gatewayName: 'paystack' | 'flutterwave') {
  return async (req: Request, res: Response) => {
    try {
      if (!paymentRegistry.has(gatewayName)) return res.sendStatus(503);
      const provider = paymentRegistry.get(gatewayName);
      const raw = req.body as Buffer;
      if (!Buffer.isBuffer(raw)) return res.sendStatus(400);
      if (!provider.verifyWebhookSignature(raw, req.headers)) {
        console.warn(`[webhook:${gatewayName}] signature verification failed`);
        return res.sendStatus(401);
      }
      const parsed = provider.parseWebhook(raw);
      if (!parsed) return res.sendStatus(200); // event we don't act on

      const tx = await Transaction.findOne({ gatewayReference: parsed.reference });
      if (!tx || tx.gateway !== gatewayName) return res.sendStatus(200);
      if (parsed.status === 'success') {
        await fulfill(tx);
      } else if (tx.status === 'pending') {
        tx.status = 'failed';
        await tx.save();
      }
      res.sendStatus(200);
    } catch (err) {
      console.error(`[webhook:${gatewayName}]`, err);
      res.sendStatus(500);
    }
  };
}

export const paystackWebhook = webhookHandler('paystack');
export const flutterwaveWebhook = webhookHandler('flutterwave');
