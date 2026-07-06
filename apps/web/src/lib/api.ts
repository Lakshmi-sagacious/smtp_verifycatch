const BASE = '/api';

export class ApiError extends Error {
  constructor(public status: number, message: string, public body?: unknown) {
    super(message);
  }
}

const ACCESS_KEY = 'smtp.access_token';
const REFRESH_KEY = 'smtp.refresh_token';

let accessTokenCache: string | null = null;

export function getAccessToken(): string | null {
  if (accessTokenCache !== null) return accessTokenCache;
  accessTokenCache = localStorage.getItem(ACCESS_KEY);
  return accessTokenCache;
}
export function setAccessToken(token: string | null) {
  accessTokenCache = token;
  if (token) localStorage.setItem(ACCESS_KEY, token);
  else localStorage.removeItem(ACCESS_KEY);
}
export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_KEY);
}
export function setRefreshToken(token: string | null) {
  if (token) localStorage.setItem(REFRESH_KEY, token);
  else localStorage.removeItem(REFRESH_KEY);
}

async function rawFetch<T>(path: string, opts: RequestInit, token: string | null): Promise<T> {
  const res = await fetch(BASE + path, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...opts.headers,
    },
  });
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  const body = text ? safeJson(text) : undefined;
  if (!res.ok) {
    const msg =
      (body && typeof body === 'object' && 'message' in body && typeof (body as any).message === 'string'
        ? (body as any).message
        : res.statusText) || 'Request failed';
    throw new ApiError(res.status, msg, body);
  }
  return body as T;
}

function safeJson(t: string): unknown {
  try {
    return JSON.parse(t);
  } catch {
    return t;
  }
}

let refreshInflight: Promise<string | null> | null = null;

async function attemptRefresh(): Promise<string | null> {
  const refresh = getRefreshToken();
  if (!refresh) return null;
  if (refreshInflight) return refreshInflight;
  refreshInflight = (async () => {
    try {
      const r = await rawFetch<{ accessToken: string }>(
        '/auth/refresh',
        { method: 'POST', body: JSON.stringify({ refreshToken: refresh }) },
        null,
      );
      setAccessToken(r.accessToken);
      return r.accessToken;
    } catch {
      setAccessToken(null);
      setRefreshToken(null);
      return null;
    } finally {
      refreshInflight = null;
    }
  })();
  return refreshInflight;
}

export async function api<T>(path: string, opts: RequestInit = {}): Promise<T> {
  try {
    return await rawFetch<T>(path, opts, getAccessToken());
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) {
      const fresh = await attemptRefresh();
      if (fresh) return rawFetch<T>(path, opts, fresh);
    }
    throw err;
  }
}
