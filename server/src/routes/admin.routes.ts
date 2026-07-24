import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate';
import { requireAuth, requireAdmin } from '../middleware/auth';
import * as admin from '../controllers/admin.controller';

const router = Router();
router.use(requireAuth, requireAdmin);

router.get('/users', admin.listUsers);
router.post('/users/:userId/suspend', admin.suspendUser);
router.get('/ceremonies', admin.listCeremonies);
router.get('/groups', admin.listGroups);
router.get('/settings', admin.getSiteSettings);
router.patch('/settings', admin.updateSiteSettings);
router.get('/promo-codes', admin.listPromoCodes);

const promoSchema = z.object({
  code: z.string().trim().max(40).optional(),
  discountType: z.enum(['percent', 'fixed']),
  discountValue: z.number().min(0),
  currency: z.enum(['NGN', 'USD']).optional(),
  maxUses: z.number().int().min(1).optional(),
  expiresAt: z.coerce.date().optional(),
  applicablePurposes: z.array(z.string()).optional(),
});

router.post('/promo-codes', validate(promoSchema), admin.createPromoCode);
router.patch('/promo-codes/:promoId', admin.updatePromoCode);
router.get('/analytics/revenue', admin.revenue);

export default router;
