import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate';
import { requireAuth, optionalAuth } from '../middleware/auth';
import { imageUpload } from '../middleware/upload';
import { rateLimit } from '../middleware/rateLimiter';
import * as ceremonies from '../controllers/ceremonies.controller';
import * as signatures from '../controllers/signatures.controller';

const router = Router();

const ceremonySchema = z.object({
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().max(1000).optional(),
  date: z.coerce.date(),
  shirtColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Shirt color must be a hex color.').optional(),
  garment: z.enum(['classic-tee','oversized-tee','boxy-tee','long-sleeve','crewneck','hoodie','polo']).optional(),
  visibility: z.enum(['public', 'invite', 'group']).optional(),
  groupId: z.string().optional(),
});

const assetPlacementSchema = z.object({
  url: z.string(),
  side: z.enum(['front', 'back']),
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  scale: z.number().min(0.02).max(1),
  rotation: z.number().min(-180).max(180),
  _id: z.string().optional(),
});

const updateSchema = ceremonySchema.partial().extend({
  baseAssets: z.array(assetPlacementSchema).optional(),
});

router.get('/public/:slug', optionalAuth, ceremonies.getPublicBySlug);

router.post('/', requireAuth, validate(ceremonySchema), ceremonies.create);
router.get('/', requireAuth, ceremonies.listMine);
router.get('/:id', requireAuth, ceremonies.getOne);
router.patch('/:id', requireAuth, validate(updateSchema), ceremonies.update);
router.delete('/:id', requireAuth, ceremonies.remove);
router.post('/:id/assets', requireAuth, imageUpload.single('file'), ceremonies.uploadAsset);
router.delete('/:id/assets/:assetId', requireAuth, ceremonies.removeAsset);
router.post('/:id/lock', requireAuth, ceremonies.lock);
router.get('/:id/export/access', requireAuth, ceremonies.exportAccess);

// Signatures — signing is open to guests (rate-limited), moderation is not.
router.get('/:id/signatures', optionalAuth, signatures.list);
router.post(
  '/:id/signatures',
  rateLimit(60_000, 10),
  optionalAuth,
  imageUpload.single('file'),
  signatures.create
);
router.delete('/:id/signatures/:signatureId', requireAuth, signatures.remove);

export default router;
