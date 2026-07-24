import { Request, Response, NextFunction } from 'express';
import sharp from 'sharp';
import crypto from 'crypto';
import { Ceremony } from '../models/Ceremony';
import { Signature } from '../models/Signature';
import { HttpError } from '../middleware/errorHandler';
import { storage } from '../services/storage';
import { canEdit } from './ceremonies.controller';

const CURATED_FONTS = [
  'Caveat',
  'Dancing Script',
  'Homemade Apple',
  'Shadows Into Light',
  'Public Sans',
  'Young Serif',
];

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const ceremony = await Ceremony.findById(req.params.id);
    if (!ceremony) throw new HttpError(404, 'Ceremony not found.');
    const editable = req.auth ? await canEdit(ceremony, req.auth.sub) : false;
    const filter: Record<string, unknown> = { ceremonyId: ceremony._id };
    if (!editable) filter.moderationStatus = 'visible';
    const signatures = await Signature.find(filter).sort({ createdAt: 1 });
    res.json({ signatures });
  } catch (err) {
    next(err);
  }
}

/** Guests and signed-in users both land here; guests must supply guestName. */
export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const ceremony = await Ceremony.findById(req.params.id);
    if (!ceremony) throw new HttpError(404, 'Ceremony not found.');
    if (ceremony.isLocked) {
      throw new HttpError(423, 'This ceremony is closed — it is no longer accepting signatures.');
    }

    const { type, side, guestName } = req.body;
    if (!req.auth && !String(guestName ?? '').trim()) {
      throw new HttpError(400, 'Enter a display name to sign as a guest.');
    }
    if (!['text', 'draw', 'image'].includes(type)) {
      throw new HttpError(400, 'Signature type must be text, draw, or image.');
    }
    if (!['front', 'back'].includes(side)) {
      throw new HttpError(400, 'Side must be front or back.');
    }

    const x = clamp(Number(req.body.x), 0, 1, 0.5);
    const y = clamp(Number(req.body.y), 0, 1, 0.5);
    const rotation = clamp(Number(req.body.rotation), -180, 180, 0);
    const scale = clamp(Number(req.body.scale), 0.02, 1, 0.2);

    let content: string;
    let fontFamily: string | undefined;
    let color: string | undefined;
    let fontSize: number | undefined;

    if (type === 'text') {
      const text = String(req.body.content ?? '').trim();
      if (!text || text.length > 60) {
        throw new HttpError(400, 'Text signatures must be 1-60 characters.');
      }
      content = text;
      fontFamily = CURATED_FONTS.includes(req.body.fontFamily)
        ? req.body.fontFamily
        : CURATED_FONTS[0];
      color = /^#[0-9A-Fa-f]{6}$/.test(req.body.color ?? '') ? req.body.color : '#161D18';
      fontSize = clamp(Number(req.body.fontSize), 0.01, 0.3, 0.05);
    } else {
      // Drawn strokes and uploaded images both arrive as a multipart file.
      if (!req.file) throw new HttpError(400, 'Attach an image file for this signature type.');
      const pipeline = sharp(req.file.buffer).resize({
        width: 1200,
        height: 1200,
        fit: 'inside',
        withoutEnlargement: true,
      });
      const processed = await pipeline.png().toBuffer();
      const key = `ceremonies/${ceremony._id}/signatures/${crypto.randomUUID()}.png`;
      content = await storage.save(processed, key, 'image/png');
    }

    const signature = await Signature.create({
      ceremonyId: ceremony._id,
      authorUserId: req.auth?.sub,
      guestName: req.auth ? undefined : String(guestName).trim(),
      type,
      content,
      fontFamily,
      color,
      fontSize,
      side,
      x,
      y,
      rotation,
      scale,
    });
    res.status(201).json({ signature });
  } catch (err) {
    next(err);
  }
}

/** Moderation: ceremony owner/editors (or platform admin) remove a signature. */
export async function remove(req: Request, res: Response, next: NextFunction) {
  try {
    const ceremony = await Ceremony.findById(req.params.id);
    if (!ceremony) throw new HttpError(404, 'Ceremony not found.');
    const allowed = req.auth!.role === 'admin' || (await canEdit(ceremony, req.auth!.sub));
    if (!allowed) throw new HttpError(403, 'Only the ceremony owner or editors can remove signatures.');
    const signature = await Signature.findOneAndDelete({
      _id: req.params.signatureId,
      ceremonyId: ceremony._id,
    });
    if (!signature) throw new HttpError(404, 'Signature not found.');
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

function clamp(n: number, min: number, max: number, fallback: number): number {
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
}
