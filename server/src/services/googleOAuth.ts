import { env } from '../config/env';

// Manual OAuth 2.0 authorization-code flow against Google's documented
// endpoints. Chosen over Passport to keep the dependency surface small; the
// flow is three requests: consent redirect, code-for-token exchange, profile
// fetch. Verify endpoint URLs against Google's current docs if this breaks.

const AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const USERINFO_ENDPOINT = 'https://openidconnect.googleapis.com/v1/userinfo';

export function buildGoogleAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: env.google.clientId,
    redirect_uri: env.google.callbackUrl,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    access_type: 'online',
    prompt: 'select_account',
  });
  return `${AUTH_ENDPOINT}?${params.toString()}`;
}

export interface GoogleProfile {
  googleId: string;
  email: string;
  name: string;
  avatarUrl?: string;
}

export async function exchangeCodeForProfile(code: string): Promise<GoogleProfile> {
  const tokenRes = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: env.google.clientId,
      client_secret: env.google.clientSecret,
      redirect_uri: env.google.callbackUrl,
      grant_type: 'authorization_code',
    }),
  });
  if (!tokenRes.ok) {
    throw new Error(`Google token exchange failed: ${tokenRes.status} ${await tokenRes.text()}`);
  }
  const { access_token } = (await tokenRes.json()) as { access_token: string };

  const profileRes = await fetch(USERINFO_ENDPOINT, {
    headers: { Authorization: `Bearer ${access_token}` },
  });
  if (!profileRes.ok) {
    throw new Error(`Google userinfo failed: ${profileRes.status}`);
  }
  const profile = (await profileRes.json()) as {
    sub: string;
    email: string;
    name?: string;
    picture?: string;
  };

  if (!profile.email) throw new Error('Google profile did not include an email.');

  return {
    googleId: profile.sub,
    email: profile.email.toLowerCase(),
    name: profile.name ?? profile.email.split('@')[0],
    avatarUrl: profile.picture,
  };
}
