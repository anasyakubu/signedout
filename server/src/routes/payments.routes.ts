import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate';
import { requireAuth } from '../middleware/auth';
import { rateLimit } from '../middleware/rateLimiter';
import * as payments from '../controllers/payments.controller';

const router = Router();

const checkoutSchema = z.object({
  purpose: z.enum(['ceremony_creation', 'download_unlock', 'group_upgrade']),
  ceremonyId: z.string().optional(),
  groupId: z.string().optional(),
  currency: z.enum(['NGN', 'USD']),
  promoCode: z.string().trim().max(40).optional(),
});

router.post('/checkout', requireAuth, rateLimit(60_000, 10), validate(checkoutSchema), payments.checkout);
router.get('/verify/:reference', requireAuth, payments.verify);

export default router;
