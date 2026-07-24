import bcrypt from 'bcryptjs';
import { connectDb } from '../config/db';
import { env } from '../config/env';
import { User } from '../models/User';

async function seedAdmin() {
  const { email, password } = env.adminSeed;
  if (!email || !password) {
    console.log('[seed] ADMIN_SEED_EMAIL / ADMIN_SEED_PASSWORD not set — skipping admin seed.');
    return;
  }
  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) {
    if (existing.role !== 'admin') {
      existing.role = 'admin';
      await existing.save();
      console.log(`[seed] promoted existing account ${email} to admin.`);
    } else {
      console.log(`[seed] admin ${email} already exists.`);
    }
    return;
  }
  await User.create({
    name: 'Admin',
    email: email.toLowerCase(),
    passwordHash: await bcrypt.hash(password, 12),
    authProvider: 'local',
    role: 'admin',
  });
  console.log(`[seed] created admin account ${email}.`);
}

// Runs standalone via `npm run seed:admin`, and is also called on server boot.
if (require.main === module) {
  connectDb()
    .then(seedAdmin)
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

export { seedAdmin };
