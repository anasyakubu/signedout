import mongoose from 'mongoose';
import { env } from './env';

export async function connectDb(): Promise<void> {
  mongoose.connection.on('error', (err) => {
    console.error('[mongo] connection error:', err.message);
  });
  await mongoose.connect(env.mongodbUri, {
    dbName: "signedout-db", // Database name
  });
  console.log('[mongo] connected');
}
