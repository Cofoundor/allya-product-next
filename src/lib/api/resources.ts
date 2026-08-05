/* Every endpoint the UI consumes, in one place: paths for reads (so they can
   be cached, prefetched and handed to useResource) and functions for writes. */

import { get, invalidate, patch, post, prefetch } from './client';
import type {
  AnswerKey,
  Answers,
  DraftCampaign,
  Fact,
  OnboardingResult,
  Period,
  Reply,
  Review,
  Send,
  WorkAction,
} from './types';

export const paths = {
  surfaces: () => '/surfaces',
  surface: (sid: string) => `/surfaces/${sid}`,
  brain: (sid: string) => `/surfaces/${sid}/brain`,
  work: (sid: string) => `/surfaces/${sid}/work`,
  schedule: (sid: string) => `/surfaces/${sid}/schedule`,
  /** a month of the grid; omit `month` and the server answers with the current one */
  calendar: (sid: string, month?: string | null) =>
    `/surfaces/${sid}/calendar${month ? `?month=${month}` : ''}`,
  calendarDay: (sid: string, date: string) => `/surfaces/${sid}/calendar/${date}`,
  knowledge: (sid: string, period?: Period | null, date?: string | null) =>
    `/surfaces/${sid}/knowledge${date ? `?date=${date}` : period ? `?period=${period}` : ''}`,
  conversation: (sid: string) => `/surfaces/${sid}/conversation`,
  review: (wid: string) => `/work/${wid}/review`,
  gate: () => '/gate',
  onboarding: (sid: string) => `/surfaces/${sid}/onboarding`,
  instrument: (sid: string) => `/surfaces/${sid}/instrument`,
  directions: () => '/directions',
  direction: (did: string) => `/directions/${did}`,
  campaigns: (did: string) => `/directions/${did}/campaigns`,
  campaign: (did: string, cid: string) => `/directions/${did}/campaigns/${cid}`,
  questions: (did: string) => `/directions/${did}/questions`,
  ideas: (did: string) => `/directions/${did}/ideas`,
  directionWork: (did: string) => `/directions/${did}/work`,
};

/** finish a floor's setup — the graph and the lock both change behind this */
export async function completeOnboarding(sid: string, answers: Record<string, string>) {
  const res = await post<OnboardingResult>(paths.onboarding(sid), { answers });
  invalidate(`/surfaces/${sid}`); // the surface, its brain and its lock all moved
  return res;
}

/** where a surface lives — the workspace is the root, services are slugs.
    Mirrors the `href` the API returns from /surfaces. A direction is not a
    surface: its href comes from /directions, which the caller has. */
export const surfaceHref = (sid: string) => (sid === 'workspace' ? '/' : `/${sid}`);

/** pull a surface's page data down before navigating into it */
export function warmSurface(sid: string, direction = false) {
  // a direction's page reads its own endpoints, and it isn't a surface
  if (direction) {
    prefetch(paths.direction(sid));
    prefetch(paths.campaigns(sid));
    return;
  }
  prefetch(paths.surface(sid));
  prefetch(paths.brain(sid));
  prefetch(paths.work(sid));
  prefetch(paths.conversation(sid));
  // the island's calendar renders on arrival too; its day view can't be
  // warmed, since which day to open is the month response's answer
  prefetch(paths.calendar(sid));
}

export const sendMessage = (sid: string, text: string) =>
  post<Reply>(`/surfaces/${sid}/conversation/messages`, { text });

export const getReview = (wid: string) => get<Review>(paths.review(wid));

async function act(wid: string, verb: 'approve' | 'undo') {
  const res = await post<WorkAction>(`/work/${wid}/${verb}`);
  invalidate('/surfaces'); // work counts changed everywhere they're shown
  return res;
}

export const approveWork = (wid: string) => act(wid, 'approve');
export const undoWork = (wid: string) => act(wid, 'undo');
export const requestRevision = (wid: string) => post<Reply>(`/work/${wid}/revision`);

/* ---- a campaign: written, then queued ---- */

/** compose from the five answers. Nothing is stored — this is the preview. */
export const draftCampaign = (did: string, answers: Answers) =>
  post<DraftCampaign>(`/directions/${did}/campaigns/draft`, answers);

/** queue it for review. 201, and it joins the list the pane reads. */
export async function createCampaign(did: string, answers: Answers, subject?: string) {
  const q = subject ? `?subject=${encodeURIComponent(subject)}` : '';
  const made = await post<Send>(`/directions/${did}/campaigns${q}`, answers);
  invalidate(paths.campaigns(did)); // the pane must show what was just made
  return made;
}

/** what Allya says back when an answer lands — her words, not ours */
export const ackAnswer = (did: string, key: AnswerKey, text: string) =>
  post<{ text: string }>(`/directions/${did}/questions/${key}/ack`, { text });

export async function patchFact(fid: string, body: { flagged?: boolean; text?: string }) {
  const fact = await patch<Fact>(`/knowledge/${fid}`, body);
  invalidate(`/surfaces/${fact.surfaceId}/knowledge`);
  return fact;
}
