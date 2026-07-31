/* Every endpoint the UI consumes, in one place: paths for reads (so they can
   be cached, prefetched and handed to useResource) and functions for writes. */

import { get, invalidate, patch, post, prefetch } from './client';
import type { Fact, Period, Reply, Review, WorkAction } from './types';

export const paths = {
  surfaces: () => '/surfaces',
  surface: (sid: string) => `/surfaces/${sid}`,
  brain: (sid: string) => `/surfaces/${sid}/brain`,
  work: (sid: string) => `/surfaces/${sid}/work`,
  schedule: (sid: string) => `/surfaces/${sid}/schedule`,
  knowledge: (sid: string, period?: Period | null, date?: string | null) =>
    `/surfaces/${sid}/knowledge${date ? `?date=${date}` : period ? `?period=${period}` : ''}`,
  conversation: (sid: string) => `/surfaces/${sid}/conversation`,
  review: (wid: string) => `/work/${wid}/review`,
};

/** where a surface lives — the workspace is the root, services are slugs.
    Mirrors the `href` the API returns from /surfaces. */
export const surfaceHref = (sid: string) => (sid === 'workspace' ? '/' : `/${sid}`);

/** pull a surface's page data down before navigating into it */
export function warmSurface(sid: string) {
  prefetch(paths.surface(sid));
  prefetch(paths.brain(sid));
  prefetch(paths.work(sid));
  prefetch(paths.conversation(sid));
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

export async function patchFact(fid: string, body: { flagged?: boolean; text?: string }) {
  const fact = await patch<Fact>(`/knowledge/${fid}`, body);
  invalidate(`/surfaces/${fact.surfaceId}/knowledge`);
  return fact;
}
