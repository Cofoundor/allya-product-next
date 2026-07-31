/* ============================================================
   The one place that talks to the backend.

   Base URL is configurable, every failure is an ApiError carrying the status
   the server actually returned, and GETs are memoised so a launch into a
   service page can be warmed before the route changes — the arrival should
   never wait on a round trip it could have made a second earlier.
   ============================================================ */

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000/api/v1';

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

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers: body === undefined ? undefined : { 'content-type': 'application/json' },
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
