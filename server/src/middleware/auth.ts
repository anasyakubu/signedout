import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, AccessPayload } from '../utils/jwt';

declare global {
  namespace Express {
    interface Request {
      auth?: AccessPayload;
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Sign in to continue.' });
  }
  try {
    req.auth = verifyAccessToken(header.slice(7));
    next();
  } catch {
    return res.status(401).json({ error: 'Your session expired. Sign in again.' });
  }
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (req.auth?.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required.' });
  }
  next();
}

// Attaches req.auth when a valid bearer token is present, but never rejects —
// used on routes that accept both guests and signed-in users (public signing).
export function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) {
    try {
      req.auth = verifyAccessToken(header.slice(7));
    } catch {
      // Invalid/expired token on an optional route: treat as guest.
    }
  }
  next();
}
