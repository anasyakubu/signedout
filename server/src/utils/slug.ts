import crypto from 'crypto';

export function makeSlug(title: string): string {
  const base = title
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 48) || 'ceremony';
  return `${base}-${crypto.randomBytes(3).toString('hex')}`;
}

export function makeJoinCode(): string {
  return crypto.randomBytes(4).toString('hex').toUpperCase();
}

export function makeReference(prefix: string): string {
  return `so_${prefix}_${crypto.randomUUID().replace(/-/g, '')}`;
}
