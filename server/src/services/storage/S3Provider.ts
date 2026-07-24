import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { StorageProvider } from './StorageProvider';

export class S3Provider implements StorageProvider {
  private client: S3Client;

  constructor(
    private bucket: string,
    region: string,
    private cloudfrontDomain?: string
  ) {
    this.client = new S3Client({ region });
  }

  async save(buffer: Buffer, key: string, contentType: string): Promise<string> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType,
        CacheControl: 'public, max-age=31536000, immutable',
      })
    );
    return this.cloudfrontDomain
      ? `https://${this.cloudfrontDomain}/${key}`
      : `https://${this.bucket}.s3.amazonaws.com/${key}`;
  }

  async delete(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }
}
