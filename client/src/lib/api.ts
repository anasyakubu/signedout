// Central API client. The access token lives only in memory; the refresh token
// lives in an httpOnly cookie scoped to /api/auth, so a page reload recovers
// the session by calling refresh() once on boot.

let accessToken: string | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export interface PublicUser {
  id: string;
  name: string;
  email: string;
  authProvider: 'local' | 'google' | 'both';
  avatarUrl: string | null;
  role: 'user' | 'admin';
  bio: string | null;
  department: string | null;
  school: string | null;
  graduationYear: number | null;
  createdAt: string;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    /** Full parsed error body — e.g. 402 responses carry paymentRequired. */
    public body?: Record<string, unknown>
  ) {
    super(message);
  }
}

async function rawRequest(path: string, options: RequestInit = {}): Promise<Response> {
  const headers = new Headers(options.headers);
  // FormData must set its own multipart boundary — only default to JSON for
  // string bodies.
  if (options.body && !(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
  return fetch(path, { ...options, headers, credentials: 'include' });
}

export async function refreshSession(): Promise<{ accessToken: string; user: PublicUser } | null> {
  const res = await fetch('/api/auth/refresh', { method: 'POST', credentials: 'include' });
  if (!res.ok) return null;
  const data = (await res.json()) as { accessToken: string; user: PublicUser };
  accessToken = data.accessToken;
  return data;
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  let res = await rawRequest(path, options);

  // Access tokens are short-lived by design; on a 401, try one silent refresh
  // and replay the request before surfacing an error.
  if (res.status === 401 && !path.startsWith('/api/auth/')) {
    const refreshed = await refreshSession();
    if (refreshed) {
      res = await rawRequest(path, options);
    }
  }

  if (!res.ok) {
    let message = 'Request failed.';
    let errorBody: Record<string, unknown> | undefined;
    try {
      errorBody = (await res.json()) as Record<string, unknown>;
      if (typeof errorBody.error === 'string') message = errorBody.error;
    } catch {
      // Non-JSON error body; keep the generic message.
    }
    throw new ApiError(res.status, message, errorBody);
  }
  return (await res.json()) as T;
}
