import fs from 'fs/promises';
import path from 'path';
import { StorageProvider } from './StorageProvider';

// Dev fallback when AWS is not configured. Files land in server/uploads and
// are served by express.static at /uploads (same-origin via the Vite proxy).
export class LocalStorageProvider implements StorageProvider {
  constructor(public readonly dir: string) {}

  async save(buffer: Buffer, key: string): Promise<string> {
    const target = path.join(this.dir, key);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, buffer);
    return `/uploads/${key}`;
  }

  async delete(key: string): Promise<void> {
    await fs.rm(path.join(this.dir, key), { force: true });
  }
}
