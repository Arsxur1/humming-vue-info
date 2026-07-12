/** API-клиент: JSON, Bearer-токен, авто-refresh при 401. */

export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
}

export class ApiRequestError extends Error {
  constructor(
    readonly status: number,
    readonly error: ApiError,
  ) {
    super(error.message);
    this.name = 'ApiRequestError';
  }
}

const TOKENS_KEY = 'avatarstudio.tokens';

export interface StoredTokens {
  accessToken: string;
  refreshToken: string;
}

export function getTokens(): StoredTokens | null {
  const raw = localStorage.getItem(TOKENS_KEY);
  return raw ? (JSON.parse(raw) as StoredTokens) : null;
}

export function setTokens(tokens: StoredTokens | null): void {
  if (tokens) localStorage.setItem(TOKENS_KEY, JSON.stringify(tokens));
  else localStorage.removeItem(TOKENS_KEY);
}

let refreshing: Promise<boolean> | null = null;

async function tryRefresh(): Promise<boolean> {
  refreshing ??= (async () => {
    const tokens = getTokens();
    if (!tokens) return false;
    const res = await fetch('/api/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: tokens.refreshToken }),
    });
    if (!res.ok) {
      setTokens(null);
      return false;
    }
    setTokens((await res.json()) as StoredTokens);
    return true;
  })().finally(() => {
    refreshing = null;
  });
  return refreshing;
}

export async function api<T>(
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  path: string,
  body?: unknown,
  retry = true,
): Promise<T> {
  const tokens = getTokens();
  const res = await fetch(path, {
    method,
    headers: {
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(tokens ? { Authorization: `Bearer ${tokens.accessToken}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401 && retry && (await tryRefresh())) {
    return api<T>(method, path, body, false);
  }
  if (!res.ok) {
    let error: ApiError = { code: 'UNKNOWN', message: `Ошибка ${res.status}` };
    try {
      const parsed = (await res.json()) as { error?: ApiError; message?: string };
      if (parsed.error) error = parsed.error;
      else if (parsed.message) error = { code: 'UNKNOWN', message: parsed.message };
    } catch {
      // тело не JSON
    }
    throw new ApiRequestError(res.status, error);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
