'use client';

/* Who's signed in.

   The token lives in localStorage and is attached to every request by the
   client. It's a dummy session — no expiry, no refresh — so the only states
   are "have one" and "don't". */

import { get, getToken, invalidate, post, request, setToken } from './client';
import type { Session, User } from './types';

export { getToken };

export async function signIn(email: string, password: string): Promise<Session> {
  const session = await post<Session>('/session', { email, password });
  setToken(session.token);
  invalidate(); // anything cached was fetched as nobody
  return session;
}

export async function signOut() {
  try {
    await request<void>('DELETE', '/session');
  } catch {
    // the server not knowing the token is the state we wanted anyway
  }
  setToken(null);
  invalidate();
}

/** the signed-in user, or null — never throws */
export async function whoami(): Promise<User | null> {
  if (!getToken()) return null;
  try {
    return await get<User>('/session');
  } catch {
    setToken(null); // a token the server no longer honours is no token
    return null;
  }
}
