import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { User, toPublicUser } from '../models/User';
import { Ceremony } from '../models/Ceremony';
import { Group } from '../models/Group';
import { Transaction } from '../models/Transaction';
import { PromoCode } from '../models/PromoCode';
import { getSettings } from '../models/SiteSettings';
import { HttpError } from '../middleware/errorHandler';

export async function listUsers(req: Request, res: Response, next: NextFunction) {
  try {
    const q = String(req.query.q ?? '').trim();
    const filter = q
      ? { $or: [{ name: new RegExp(escapeRegex(q), 'i') }, { email: new RegExp(escapeRegex(q), 'i') }] }
      : {};
    const users = await User.find(filter).sort({ createdAt: -1 }).limit(200);
    const withActivity = await Promise.all(
      users.map(async (u) => ({
        ...toPublicUser(u),
        isSuspended: u.isSuspended,
        ceremonyCount: await Ceremony.countDocuments({ ownerId: u._id }),
      }))
    );
    res.json({ users: withActivity });
  } catch (err) {
    next(err);
  }
}

export async function suspendUser(req: Request, res: Response, next: NextFunction) {
  try {
    if (req.params.userId === req.auth!.sub) {
      throw new HttpError(400, 'You cannot suspend your own account.');
    }
    const user = await User.findByIdAndUpdate(
      req.params.userId,
      { isSuspended: Boolean(req.body.suspended), $unset: { refreshTokenHash: 1 } },
      { new: true }
    );
    if (!user) throw new HttpError(404, 'User not found.');
    res.json({ user: { ...toPublicUser(user), isSuspended: user.isSuspended } });
  } catch (err) {
    next(err);
  }
}

export async function listCeremonies(_req: Request, res: Response, next: NextFunction) {
  try {
    const ceremonies = await Ceremony.find()
      .sort({ createdAt: -1 })
      .limit(200)
      .populate('ownerId', 'name email');
    res.json({ ceremonies });
  } catch (err) {
    next(err);
  }
}

export async function listGroups(_req: Request, res: Response, next: NextFunction) {
  try {
    const groups = await Group.find()
      .sort({ createdAt: -1 })
      .limit(200)
      .populate('ownerId', 'name email');
    res.json({ groups });
  } catch (err) {
    next(err);
  }
}

export async function getSiteSettings(_req: Request, res: Response, next: NextFunction) {
  try {
    res.json({ settings: await getSettings() });
  } catch (err) {
    next(err);
  }
}

export async function updateSiteSettings(req: Request, res: Response, next: NextFunction) {
  try {
    const settings = await getSettings();
    // Deep-merge only known keys — settings are runtime-editable, never redeploy.
    const body = req.body as Record<string, unknown>;
    if (typeof body.monetizationEnabled === 'boolean') {
      settings.monetizationEnabled = body.monetizationEnabled;
    }
    if (body.featureGates) settings.set('featureGates', merge(settings.featureGates, body.featureGates));
    if (body.pricing) settings.set('pricing', merge(settings.pricing, body.pricing));
    if (body.gateways) settings.set('gateways', merge(settings.gateways, body.gateways));
    if (body.currencyRouting) {
      settings.set('currencyRouting', merge(settings.currencyRouting, body.currencyRouting));
    }
    await settings.save();
    res.json({ settings });
  } catch (err) {
    next(err);
  }
}

function merge<T>(current: T, incoming: unknown): T {
  if (!incoming || typeof incoming !== 'object') return current;
  const out = JSON.parse(JSON.stringify(current)) as Record<string, unknown>;
  for (const [k, v] of Object.entries(incoming as Record<string, unknown>)) {
    if (!(k in out)) continue;
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      out[k] = merge(out[k], v);
    } else {
      out[k] = v;
    }
  }
  return out as T;
}

export async function listPromoCodes(_req: Request, res: Response, next: NextFunction) {
  try {
    res.json({ promoCodes: await PromoCode.find().sort({ createdAt: -1 }) });
  } catch (err) {
    next(err);
  }
}

export async function createPromoCode(req: Request, res: Response, next: NextFunction) {
  try {
    const {
      code,
      discountType,
      discountValue,
      currency,
      maxUses,
      expiresAt,
      applicablePurposes,
    } = req.body;
    if (discountType === 'fixed' && !currency) {
      throw new HttpError(400, 'Fixed-amount codes need a currency.');
    }
    const promo = await PromoCode.create({
      code: (code || `SO-${crypto.randomBytes(3).toString('hex').toUpperCase()}`).toUpperCase(),
      discountType,
      discountValue,
      currency,
      maxUses,
      expiresAt,
      applicablePurposes: applicablePurposes ?? [],
      createdBy: req.auth!.sub,
    });
    res.status(201).json({ promoCode: promo });
  } catch (err) {
    next(err);
  }
}

export async function updatePromoCode(req: Request, res: Response, next: NextFunction) {
  try {
    const allowed = ['isActive', 'maxUses', 'expiresAt', 'applicablePurposes'];
    const updates: Record<string, unknown> = {};
    for (const k of allowed) if (k in req.body) updates[k] = req.body[k];
    const promo = await PromoCode.findByIdAndUpdate(req.params.promoId, updates, { new: true });
    if (!promo) throw new HttpError(404, 'Promo code not found.');
    res.json({ promoCode: promo });
  } catch (err) {
    next(err);
  }
}

export async function revenue(_req: Request, res: Response, next: NextFunction) {
  try {
    const byCurrencyGateway = await Transaction.aggregate([
      { $match: { status: 'success' } },
      {
        $group: {
          _id: { currency: '$currency', gateway: '$gateway' },
          total: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
      { $sort: { '_id.currency': 1, '_id.gateway': 1 } },
    ]);
    const recent = await Transaction.find()
      .sort({ createdAt: -1 })
      .limit(50)
      .populate('userId', 'name email');
    res.json({ byCurrencyGateway, recent });
  } catch (err) {
    next(err);
  }
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
