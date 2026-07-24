import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate';
import * as auth from '../controllers/auth.controller';

const router = Router();

const registerSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters.').max(80),
  email: z.string().trim().toLowerCase().email('Enter a valid email address.'),
  password: z.string().min(8, 'Password must be at least 8 characters.').max(128),
});

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address.'),
  password: z.string().min(1, 'Enter your password.'),
});

router.post('/register', validate(registerSchema), auth.register);
router.post('/login', validate(loginSchema), auth.login);
router.post('/refresh', auth.refresh);
router.post('/logout', auth.logout);
router.get('/google', auth.googleStart);
router.get('/google/callback', auth.googleCallback);

export default router;
