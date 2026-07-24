import { Request, Response, NextFunction } from 'express';

// Strips Mongo operator injection ($-prefixed and dotted keys) from any
// incoming JSON body/query before it can reach a query object.
function clean(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(clean);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      if (k.startsWith('$') || k.includes('.')) continue;
      out[k] = clean(v);
    }
    return out;
  }
  return value;
}

export function sanitizeBody(req: Request, _res: Response, next: NextFunction) {
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
    req.body = clean(req.body);
  }
  next();
}
