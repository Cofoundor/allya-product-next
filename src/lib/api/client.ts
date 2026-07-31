/* ============================================================
   The one place that talks to the backend.

   Base URL is configurable, every failure is an ApiError carrying the status
   the server actually returned, and GETs are memoised so a launch into a
   service page can be warmed before the route changes — the arrival should
   never wait on a round trip it could have made a second earlier.
   ============================================================ */

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'https://allya-product-api.onrender.com/api/v1';

/* NEXT_PUBLIC_* is baked in at build time, so a deploy that forgot to set it
   ships a bundle pointing at the *visitor's* machine — every request fails
   and the page looks broken for no visible reason. Name it instead. */
const LOCAL = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:|\/|$)/;
export const misconfigured =
  typeof window !== 'undefined' && LOCAL.test(API_URL) && !LOCAL.test(window.location.origin);

if (misconfigured && typeof console !== 'undefined') {
  console.error(
    `[allya] NEXT_PUBLIC_API_URL is "${API_URL}", which points at the visitor's own machine. ` +
      `Set it to the deployed API's origin + /api/v1 and rebuild.`,
  );
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /** the backend is down / unreachable, as opposed to refusing the request */
  get offline() {
    return this.status === 0;
  }
}

/* ---- the session token ----
   Kept here rather than in session.ts so that every request can attach it
   without the two modules importing each other. */
const TOKEN_KEY = 'allya.token';

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null; // private mode: you just stay signed out
  }
}

export function setToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

export async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  if (misconfigured) throw new ApiError(0, 'This build has no API address.');
  const token = typeof window === 'undefined' ? null : getToken();
  const headers: Record<string, string> = {};
  if (body !== undefined) headers['content-type'] = 'application/json';
  if (token) headers.authorization = `Bearer ${token}`;
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, "Can't reach the server.");
  }
  if (!res.ok) {
    // FastAPI puts the reason in `detail`; fall back to the status text
    const detail = await res
      .json()
      .then((d: { detail?: string }) => d?.detail)
      .catch(() => undefined);
    throw new ApiError(res.status, detail ?? res.statusText ?? 'Request failed');
  }
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}

/** in-flight and settled GETs, keyed by path */
const cache = new Map<string, Promise<unknown>>();

export function get<T>(path: string): Promise<T> {
  const hit = cache.get(path);
  if (hit) return hit as Promise<T>;
  const p = request<T>('GET', path).catch((err) => {
    cache.delete(path); // never cache a failure — reload() must be able to retry
    throw err;
  });
  cache.set(path, p);
  return p;
}

export const post = <T>(path: string, body?: unknown) => request<T>('POST', path, body);
export const patch = <T>(path: string, body?: unknown) => request<T>('PATCH', path, body);

/** warm a GET without caring about the result — used before a route change */
export function prefetch(path: string) {
  get(path).catch(() => {});
}

/** drop cached GETs so the next read hits the server */
export function invalidate(prefix?: string) {
  if (!prefix) return cache.clear();
  for (const key of [...cache.keys()]) if (key.startsWith(prefix)) cache.delete(key);
}
