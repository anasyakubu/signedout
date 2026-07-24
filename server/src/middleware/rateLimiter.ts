import { Request, Response, NextFunction } from 'express';

// Minimal in-memory fixed-window limiter — good enough for a single-process
// deployment. Swap for a Redis-backed limiter when running multiple instances.
export function rateLimit(windowMs: number, max: number) {
  const hits = new Map<string, { count: number; resetAt: number }>();
  return (req: Request, res: Response, next: NextFunction) => {
    const key = req.ip ?? 'unknown';
    const now = Date.now();
    const entry = hits.get(key);
    if (!entry || entry.resetAt < now) {
      hits.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }
    if (entry.count >= max) {
      return res.status(429).json({ error: 'Too many requests. Slow down and try again.' });
    }
    entry.count++;
    next();
  };
}
