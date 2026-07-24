import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate';
import { requireAuth } from '../middleware/auth';
import * as users from '../controllers/users.controller';

const router = Router();

const updateMeSchema = z
  .object({
    name: z.string().trim().min(2).max(80).optional(),
    bio: z.string().trim().max(500).optional(),
    department: z.string().trim().max(120).optional(),
    school: z.string().trim().max(160).optional(),
    graduationYear: z.coerce.number().int().min(1950).max(2100).optional(),
  })
  .strict();

router.get('/me', requireAuth, users.getMe);
router.patch('/me', requireAuth, validate(updateMeSchema), users.updateMe);

export default router;
