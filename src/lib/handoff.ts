/* The onboarding → workspace handoff, carried in localStorage.
   Read it inside an effect: touching localStorage during render would
   desync the server HTML from the first client paint. */

const KEY = 'allya.onboarding';

export interface Handoff {
  company: string;
  base: string;
  category: string;
  oneWord: string;
  customer: string;
  revenueBadge: string;
  goals: string[];
  pitch: string;
  edge: string;
  answers: Record<string, string>;
  attachments: Record<string, string[]>;
  at: number;
}

export function readHandoff(): Handoff | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Handoff) : null;
  } catch {
    return null; // private mode — non-fatal
  }
}

export function saveHandoff(data: Handoff) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    /* private mode — non-fatal */
  }
}
