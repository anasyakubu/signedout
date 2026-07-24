import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate';
import { requireAuth } from '../middleware/auth';
import * as groups from '../controllers/groups.controller';

const router = Router();

router.post('/', requireAuth, validate(z.object({ name: z.string().trim().min(2).max(80) })), groups.create);
router.get('/', requireAuth, groups.listMine);
router.get('/:id', requireAuth, groups.getOne);
router.post(
  '/:id/invite',
  requireAuth,
  validate(z.object({ email: z.string().email() })),
  groups.invite
);
router.post('/join/:joinCode', requireAuth, groups.join);
router.patch(
  '/:id/members/:userId',
  requireAuth,
  validate(z.object({ role: z.enum(['editor', 'member']) })),
  groups.changeMemberRole
);

export default router;
