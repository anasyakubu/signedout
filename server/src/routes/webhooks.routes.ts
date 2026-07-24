import { Router, raw } from 'express';
import { paystackWebhook, flutterwaveWebhook } from '../controllers/payments.controller';

// Mounted BEFORE express.json so signature verification sees the raw bytes.
const router = Router();
router.post('/paystack', raw({ type: '*/*' }), paystackWebhook);
router.post('/flutterwave', raw({ type: '*/*' }), flutterwaveWebhook);

export default router;
