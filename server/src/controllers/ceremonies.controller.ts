import { Request, Response, NextFunction } from 'express';
import sharp from 'sharp';
import crypto from 'crypto';
import { Ceremony, ICeremony } from '../models/Ceremony';
import { Signature } from '../models/Signature';
import { Group, memberRole } from '../models/Group';
import { User } from '../models/User';
import { getSettings } from '../models/SiteSettings';
import { HttpError } from '../middleware/errorHandler';
import { storage } from '../services/storage';
import { makeSlug } from '../utils/slug';

/** Owner, or an owner/editor of the ceremony's group, may edit. */
export async function canEdit(ceremony: ICeremony, userId: string): Promise<boolean> {
  if (ceremony.ownerId.toString() === userId) return true;
  if (!ceremony.groupId) return false;
  const group = await Group.findById(ceremony.groupId);
  if (!group) return false;
  const role = memberRole(group, userId);
  return role === 'owner' || role === 'editor';
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.auth!.sub;
    const { title, description, date, shirtColor, visibility, groupId } = req.body;

    if (groupId) {
      const group = await Group.findById(groupId);
      if (!group) throw new HttpError(404, 'Group not found.');
      const role = memberRole(group, userId);
      if (role !== 'owner' && role !== 'editor') {
        throw new HttpError(403, 'Only group owners and editors can create a group ceremony.');
      }
    }

    // Feature gate: ceremony creation beyond the free limit is a paid action.
    const settings = await getSettings();
    if (settings.monetizationEnabled && settings.featureGates.ceremonyCreation.enabled) {
      const count = await Ceremony.countDocuments({ ownerId: userId });
      if (count >= settings.featureGates.ceremonyCreation.freeLimit) {
        const user = await User.findById(userId);
        if (!user) throw new HttpError(404, 'Account not found.');
        if (user.ceremonyCredits > 0) {
          user.ceremonyCredits -= 1;
          await user.save();
        } else {
          return res.status(402).json({
            error: `You have used your ${settings.featureGates.ceremonyCreation.freeLimit} free ceremonies.`,
            paymentRequired: {
              purpose: 'ceremony_creation',
              pricing: settings.pricing.ceremonyCreation,
            },
          });
        }
      }
    }

    const ceremony = await Ceremony.create({
      title,
      description,
      date,
      shirtColor,
      visibility: visibility ?? (groupId ? 'group' : 'public'),
      groupId: groupId || undefined,
      ownerId: userId,
      slug: makeSlug(title),
    });
    res.status(201).json({ ceremony });
  } catch (err) {
    next(err);
  }
}

export async function listMine(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.auth!.sub;
    const groups = await Group.find({ 'members.userId': userId }).select('_id');
    const ceremonies = await Ceremony.find({
      $or: [{ ownerId: userId }, { groupId: { $in: groups.map((g) => g._id) } }],
    }).sort({ createdAt: -1 });
    res.json({ ceremonies });
  } catch (err) {
    next(err);
  }
}

export async function getOne(req: Request, res: Response, next: NextFunction) {
  try {
    const ceremony = await Ceremony.findById(req.params.id);
    if (!ceremony) throw new HttpError(404, 'Ceremony not found.');
    const editable = await canEdit(ceremony, req.auth!.sub);
    if (!editable && ceremony.visibility === 'group') {
      const group = ceremony.groupId ? await Group.findById(ceremony.groupId) : null;
      if (!group || !memberRole(group, req.auth!.sub)) {
        throw new HttpError(403, 'This ceremony belongs to a group you are not in.');
      }
    }
    const signatures = await Signature.find({ ceremonyId: ceremony._id }).sort({ createdAt: 1 });
    res.json({ ceremony, signatures, canEdit: editable });
  } catch (err) {
    next(err);
  }
}

export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    const ceremony = await Ceremony.findById(req.params.id);
    if (!ceremony) throw new HttpError(404, 'Ceremony not found.');
    if (!(await canEdit(ceremony, req.auth!.sub))) {
      throw new HttpError(403, 'You do not have edit access to this ceremony.');
    }
    const allowed = ['title', 'description', 'date', 'shirtColor', 'visibility', 'baseAssets'];
    for (const key of allowed) {
      if (key in req.body) (ceremony as unknown as Record<string, unknown>)[key] = req.body[key];
    }
    await ceremony.save();
    res.json({ ceremony });
  } catch (err) {
    next(err);
  }
}

export async function remove(req: Request, res: Response, next: NextFunction) {
  try {
    const ceremony = await Ceremony.findById(req.params.id);
    if (!ceremony) throw new HttpError(404, 'Ceremony not found.');
    if (ceremony.ownerId.toString() !== req.auth!.sub) {
      throw new HttpError(403, 'Only the ceremony owner can delete it.');
    }
    await Signature.deleteMany({ ceremonyId: ceremony._id });
    await ceremony.deleteOne();
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

export async function getPublicBySlug(req: Request, res: Response, next: NextFunction) {
  try {
    const ceremony = await Ceremony.findOne({ slug: req.params.slug });
    if (!ceremony) throw new HttpError(404, 'This signing link does not exist.');
    if (ceremony.visibility === 'group') {
      // Group-only ceremonies require a signed-in group member.
      if (!req.auth) throw new HttpError(401, 'Sign in to view this group ceremony.');
      const group = ceremony.groupId ? await Group.findById(ceremony.groupId) : null;
      if (!group || !memberRole(group, req.auth.sub)) {
        throw new HttpError(403, 'This ceremony is only open to its group members.');
      }
    }
    const signatures = await Signature.find({
      ceremonyId: ceremony._id,
      moderationStatus: 'visible',
    }).sort({ createdAt: 1 });
    res.json({
      ceremony: {
        id: ceremony._id,
        title: ceremony.title,
        description: ceremony.description,
        date: ceremony.date,
        shirtColor: ceremony.shirtColor,
        baseAssets: ceremony.baseAssets,
        isLocked: ceremony.isLocked,
        slug: ceremony.slug,
      },
      signatures,
    });
  } catch (err) {
    next(err);
  }
}

export async function uploadAsset(req: Request, res: Response, next: NextFunction) {
  try {
    const ceremony = await Ceremony.findById(req.params.id);
    if (!ceremony) throw new HttpError(404, 'Ceremony not found.');
    if (!(await canEdit(ceremony, req.auth!.sub))) {
      throw new HttpError(403, 'You do not have edit access to this ceremony.');
    }
    if (!req.file) throw new HttpError(400, 'Attach an image file.');

    // Normalize artwork: cap at 1600px, re-encode as PNG (preserves transparency).
    const processed = await sharp(req.file.buffer)
      .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
      .png()
      .toBuffer();
    const key = `ceremonies/${ceremony._id}/assets/${crypto.randomUUID()}.png`;
    const url = await storage.save(processed, key, 'image/png');

    const { side, x, y, scale, rotation } = req.body;
    ceremony.baseAssets.push({
      url,
      side: side === 'back' ? 'back' : 'front',
      x: clamp01(Number(x), 0.5),
      y: clamp01(Number(y), 0.35),
      scale: clampNum(Number(scale), 0.02, 1, 0.4),
      rotation: clampNum(Number(rotation), -180, 180, 0),
    });
    await ceremony.save();
    res.status(201).json({ ceremony });
  } catch (err) {
    next(err);
  }
}

export async function removeAsset(req: Request, res: Response, next: NextFunction) {
  try {
    const ceremony = await Ceremony.findById(req.params.id);
    if (!ceremony) throw new HttpError(404, 'Ceremony not found.');
    if (!(await canEdit(ceremony, req.auth!.sub))) {
      throw new HttpError(403, 'You do not have edit access to this ceremony.');
    }
    ceremony.baseAssets = ceremony.baseAssets.filter(
      (a) => a._id?.toString() !== req.params.assetId
    );
    await ceremony.save();
    res.json({ ceremony });
  } catch (err) {
    next(err);
  }
}

export async function lock(req: Request, res: Response, next: NextFunction) {
  try {
    const ceremony = await Ceremony.findById(req.params.id);
    if (!ceremony) throw new HttpError(404, 'Ceremony not found.');
    if (!(await canEdit(ceremony, req.auth!.sub))) {
      throw new HttpError(403, 'You do not have edit access to this ceremony.');
    }
    ceremony.isLocked = Boolean(req.body.locked ?? true);
    await ceremony.save();
    res.json({ ceremony });
  } catch (err) {
    next(err);
  }
}

/**
 * Export gating decision. The export itself renders client-side (identical
 * drawing code to the live 3D texture, so what you see is what prints); this
 * endpoint is the server-authoritative answer on whether the download is
 * unlocked and whether the preview watermark applies.
 */
export async function exportAccess(req: Request, res: Response, next: NextFunction) {
  try {
    const ceremony = await Ceremony.findById(req.params.id);
    if (!ceremony) throw new HttpError(404, 'Ceremony not found.');
    if (!(await canEdit(ceremony, req.auth!.sub))) {
      throw new HttpError(403, 'Only the ceremony owner or editors can export.');
    }
    const settings = await getSettings();
    const gated = settings.monetizationEnabled && settings.featureGates.designDownload.enabled;
    const allowed = !gated || ceremony.isPaidTier;
    res.json({
      allowed: true, // preview export always allowed
      watermark: !allowed,
      paymentRequired: allowed
        ? null
        : { purpose: 'download_unlock', pricing: settings.pricing.designDownload },
    });
  } catch (err) {
    next(err);
  }
}

function clamp01(n: number, fallback: number): number {
  return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : fallback;
}
function clampNum(n: number, min: number, max: number, fallback: number): number {
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
}
