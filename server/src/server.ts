import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { connectDb } from './config/db';
import { env } from './config/env';
import { errorHandler } from './middleware/errorHandler';
import { sanitizeBody } from './middleware/sanitize';
import { rateLimit } from './middleware/rateLimiter';
import { seedAdmin } from './scripts/seedAdmin';
import { UPLOADS_DIR, storage } from './services/storage';
import { LocalStorageProvider } from './services/storage/LocalStorageProvider';
import authRoutes from './routes/auth.routes';
import usersRoutes from './routes/users.routes';
import ceremoniesRoutes from './routes/ceremonies.routes';
import groupsRoutes from './routes/groups.routes';
import paymentsRoutes from './routes/payments.routes';
import webhookRoutes from './routes/webhooks.routes';
import adminRoutes from './routes/admin.routes';

async function main() {
  await connectDb();
  await seedAdmin();

  const app = express();
  app.set('trust proxy', 1);

  app.use(cors({ origin: env.clientUrl, credentials: true }));

  // Webhooks need the raw body for signature verification, so they mount
  // before the JSON parser.
  app.use('/api/payments/webhook', webhookRoutes);

  app.use(express.json({ limit: '2mb' }));
  app.use(cookieParser());
  app.use(sanitizeBody);

  if (storage instanceof LocalStorageProvider) {
    app.use('/uploads', express.static(UPLOADS_DIR, { maxAge: '365d', immutable: true }));
  }

  app.get('/api/health', (_req, res) => res.json({ ok: true }));
  app.use('/api/auth', rateLimit(60_000, 30), authRoutes);
  app.use('/api/users', usersRoutes);
  app.use('/api/ceremonies', ceremoniesRoutes);
  app.use('/api/groups', groupsRoutes);
  app.use('/api/payments', paymentsRoutes);
  app.use('/api/admin', adminRoutes);

  app.use(errorHandler);

  app.listen(env.port, () => {
    console.log(`[server] listening on http://localhost:${env.port}`);
  });
}

main().catch((err) => {
  console.error('[server] failed to start:', err);
  process.exit(1);
});
