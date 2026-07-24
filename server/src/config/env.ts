import dotenv from 'dotenv';
dotenv.config();

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 4000),
  mongodbUri: required('MONGODB_URI'),
  jwtAccessSecret: required('JWT_ACCESS_SECRET'),
  jwtRefreshSecret: required('JWT_REFRESH_SECRET'),
  clientUrl: process.env.CLIENT_URL ?? 'http://localhost:5173',
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID ?? '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
    callbackUrl: process.env.GOOGLE_CALLBACK_URL ?? 'http://localhost:4000/api/auth/google/callback',
    get configured() {
      return Boolean(this.clientId && this.clientSecret);
    },
  },
  adminSeed: {
    email: process.env.ADMIN_SEED_EMAIL ?? '',
    password: process.env.ADMIN_SEED_PASSWORD ?? '',
  },
};

export const isProd = env.nodeEnv === 'production';
