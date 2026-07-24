export interface StorageProvider {
  /** Persist a buffer, return a public URL for it. */
  save(buffer: Buffer, key: string, contentType: string): Promise<string>;
  delete(key: string): Promise<void>;
}
