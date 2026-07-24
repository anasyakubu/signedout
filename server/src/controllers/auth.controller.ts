import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { User, toPublicUser, IUser } from '../models/User';
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  hashToken,
  setRefreshCookie,
  clearRefreshCookie,
  REFRESH_COOKIE,
} from '../utils/jwt';
import { HttpError } from '../middleware/errorHandler';
import { buildGoogleAuthUrl, exchangeCodeForProfile } from '../services/googleOAuth';
import { env } from '../config/env';
import crypto from 'crypto';

async function issueSession(res: Response, user: IUser) {
  const accessToken = signAccessToken({ sub: user._id.toString(), role: user.role });
  const refreshToken = signRefreshToken(user._id.toString());
  user.refreshTokenHash = hashToken(refreshToken);
  await user.save();
  setRefreshCookie(res, refreshToken);
  return accessToken;
}

export async function register(req: Request, res: Response, next: NextFunction) {
  try {
    const { name, email, password } = req.body as { name: string; email: string; password: string };
    const existing = await User.findOne({ email });
    if (existing) throw new HttpError(409, 'An account with this email already exists.');

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({ name, email, passwordHash, authProvider: 'local' });
    const accessToken = await issueSession(res, user);
    res.status(201).json({ accessToken, user: toPublicUser(user) });
  } catch (err) {
    next(err);
  }
}

export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const { email, password } = req.body as { email: string; password: string };
    const user = await User.findOne({ email });
    if (!user || !user.passwordHash) {
      throw new HttpError(401, 'Email or password is incorrect.');
    }
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) throw new HttpError(401, 'Email or password is incorrect.');
    if (user.isSuspended) throw new HttpError(403, 'This account has been suspended.');

    const accessToken = await issueSession(res, user);
    res.json({ accessToken, user: toPublicUser(user) });
  } catch (err) {
    next(err);
  }
}

export async function refresh(req: Request, res: Response, next: NextFunction) {
  try {
    const token = req.cookies?.[REFRESH_COOKIE];
    if (!token) throw new HttpError(401, 'No session.');

    let payload: { sub: string };
    try {
      payload = verifyRefreshToken(token);
    } catch {
      throw new HttpError(401, 'Session expired. Sign in again.');
    }

    const user = await User.findById(payload.sub).select('+refreshTokenHash');
    if (user?.isSuspended) {
      clearRefreshCookie(res);
      throw new HttpError(403, 'This account has been suspended.');
    }
    if (!user || user.refreshTokenHash !== hashToken(token)) {
      // Token reuse or revoked session: invalidate everything for this user.
      if (user) {
        user.refreshTokenHash = undefined;
        await user.save();
      }
      clearRefreshCookie(res);
      throw new HttpError(401, 'Session expired. Sign in again.');
    }

    const accessToken = await issueSession(res, user); // rotates refresh token
    res.json({ accessToken, user: toPublicUser(user) });
  } catch (err) {
    next(err);
  }
}

export async function logout(req: Request, res: Response, next: NextFunction) {
  try {
    const token = req.cookies?.[REFRESH_COOKIE];
    if (token) {
      try {
        const { sub } = verifyRefreshToken(token);
        await User.findByIdAndUpdate(sub, { $unset: { refreshTokenHash: 1 } });
      } catch {
        // Expired/invalid token: nothing to revoke.
      }
    }
    clearRefreshCookie(res);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

// ---- Google OAuth (manual flow, no Passport dependency) ----

const OAUTH_STATE_COOKIE = 'signedout_oauth_state';

export function googleStart(_req: Request, res: Response, next: NextFunction) {
  try {
    if (!env.google.configured) {
      throw new HttpError(503, 'Google sign-in is not configured on this server.');
    }
    const state = crypto.randomBytes(16).toString('hex');
    res.cookie(OAUTH_STATE_COOKIE, state, {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 10 * 60 * 1000,
    });
    res.redirect(buildGoogleAuthUrl(state));
  } catch (err) {
    next(err);
  }
}

export async function googleCallback(req: Request, res: Response, next: NextFunction) {
  try {
    const { code, state } = req.query as { code?: string; state?: string };
    const expectedState = req.cookies?.[OAUTH_STATE_COOKIE];
    res.clearCookie(OAUTH_STATE_COOKIE);

    if (!code || !state || !expectedState || state !== expectedState) {
      return res.redirect(`${env.clientUrl}/login?error=oauth_failed`);
    }

    const profile = await exchangeCodeForProfile(code);

    let user = await User.findOne({ $or: [{ googleId: profile.googleId }, { email: profile.email }] });
    if (!user) {
      user = await User.create({
        name: profile.name,
        email: profile.email,
        googleId: profile.googleId,
        avatarUrl: profile.avatarUrl,
        authProvider: 'google',
      });
    } else if (!user.googleId) {
      // Existing local account signing in with Google for the first time.
      user.googleId = profile.googleId;
      user.authProvider = 'both';
      if (!user.avatarUrl) user.avatarUrl = profile.avatarUrl;
      await user.save();
    }

    if (user.isSuspended) {
      return res.redirect(`${env.clientUrl}/login?error=suspended`);
    }

    await issueSession(res, user);
    // Client lands on /auth/callback and calls POST /api/auth/refresh to pick
    // up its access token from the freshly set refresh cookie.
    res.redirect(`${env.clientUrl}/auth/callback`);
  } catch (err) {
    console.error('[google oauth]', err);
    res.redirect(`${env.clientUrl}/login?error=oauth_failed`);
  }
}
