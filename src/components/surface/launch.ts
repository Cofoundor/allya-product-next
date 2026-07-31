/* The hand-off between the two halves of a launch.

   Flying into a service node happens on one page and lands on another, so
   the fact that you *flew* has to survive a navigation. It's deliberately
   short-lived: a reload, a back button, or a slow trip means you arrive
   normally instead of mid-flight, which is the right fallback. */

const KEY = 'allya.launch';
const FRESH_MS = 2500;

export function markLaunch(service: string) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ service, at: Date.now() }));
  } catch {
    /* private mode — the arrival just plays its own intro */
  }
}

/** true once, if this surface is the one we just flew into */
export function takeLaunch(service: string) {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return false;
    sessionStorage.removeItem(KEY);
    const { service: s, at } = JSON.parse(raw) as { service: string; at: number };
    return s === service && Date.now() - at < FRESH_MS;
  } catch {
    return false;
  }
}
