import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { Response } from 'express';
import { env, isProd } from '../config/env';

const ACCESS_TTL = '15m';
const REFRESH_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days
export const REFRESH_COOKIE = 'signedout_refresh';

export interface AccessPayload {
  sub: string;
  role: 'user' | 'admin';
}

export function signAccessToken(payload: AccessPayload): string {
  return jwt.sign(payload, env.jwtAccessSecret, { expiresIn: ACCESS_TTL });
}

export function verifyAccessToken(token: string): AccessPayload {
  return jwt.verify(token, env.jwtAccessSecret) as AccessPayload;
}

export function signRefreshToken(userId: string): string {
  // jti lets us rotate: each refresh token is single-use because its hash is
  // stored on the user and replaced on every rotation.
  return jwt.sign({ sub: userId, jti: crypto.randomUUID() }, env.jwtRefreshSecret, {
    expiresIn: '30d',
  });
}

export function verifyRefreshToken(token: string): { sub: string; jti: string } {
  return jwt.verify(token, env.jwtRefreshSecret) as { sub: string; jti: string };
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function setRefreshCookie(res: Response, token: string): void {
  res.cookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    path: '/api/auth',
    maxAge: REFRESH_TTL_MS,
  });
}

export function clearRefreshCookie(res: Response): void {
  res.clearCookie(REFRESH_COOKIE, { path: '/api/auth' });
}
