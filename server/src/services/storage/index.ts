import path from 'path';
import { StorageProvider } from './StorageProvider';
import { LocalStorageProvider } from './LocalStorageProvider';
import { S3Provider } from './S3Provider';

export const UPLOADS_DIR = path.resolve(__dirname, '../../../uploads');

function build(): StorageProvider {
  const { AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION, S3_BUCKET, CLOUDFRONT_DOMAIN } =
    process.env;
  if (AWS_ACCESS_KEY_ID && AWS_SECRET_ACCESS_KEY && AWS_REGION && S3_BUCKET) {
    console.log('[storage] using S3 provider');
    return new S3Provider(S3_BUCKET, AWS_REGION, CLOUDFRONT_DOMAIN || undefined);
  }
  console.log('[storage] AWS not configured — using local disk provider');
  return new LocalStorageProvider(UPLOADS_DIR);
}

export const storage: StorageProvider = build();
