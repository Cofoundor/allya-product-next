/* Every endpoint the UI consumes, in one place: paths for reads (so they can
   be cached, prefetched and handed to useResource) and functions for writes. */

import { get, invalidate, patch, post, prefetch } from './client';
import type {
  AnswerKey,
  Answers,
  Deal,
  DraftCampaign,
  Fact,
  Followup,
  ImportPreview,
  ImportResult,
  MoveResult,
  OnboardingResult,
  Period,
  Person,
  PersonDetail,
  PersonKind,
  Reply,
  Review,
  Segment,
  SegmentRule,
  Send,
  Touch,
  TouchBy,
  TouchKind,
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

  /* the people layer — one book, read by every floor */
  crm: () => '/crm',
  people: (f: PeopleFilter = {}) => {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(f)) if (v) qs.set(k, String(v));
    const s = qs.toString();
    return `/crm/people${s ? `?${s}` : ''}`;
  },
  person: (pid: string) => `/crm/people/${pid}`,
  journey: (pid: string) => `/crm/people/${pid}/journey`,
  companies: () => '/crm/companies',
  company: (cid: string) => `/crm/companies/${cid}`,
  companyPeople: (cid: string) => `/crm/companies/${cid}/people`,
  deals: (state?: string) => `/crm/deals${state ? `?state=${state}` : ''}`,
  deal: (did: string) => `/crm/deals/${did}`,
  /** `source` narrows every funnel to one door in — the only way to see
      that the channel filling the top isn't filling the bottom */
  pipelines: (source?: string | null) => `/crm/pipelines${source ? `?source=${source}` : ''}`,
  pipeline: (plid: string, source?: string | null) =>
    `/crm/pipelines/${plid}${source ? `?source=${source}` : ''}`,
  segments: () => '/crm/segments',
  segment: (sid: string) => `/crm/segments/${sid}`,
  segmentPeople: (sid: string) => `/crm/segments/${sid}/people`,
  sources: () => '/crm/sources',
  /** which columns the grid can show, and the named sets to pick between */
  crmTable: () => '/crm/table',
  /** the words the interface puts on this API's enums — read once, cached */
  lexicon: () => '/crm/lexicon',
  /** every door in, ranked by what actually gets anywhere */
  origins: () => '/crm/origins',
  followups: () => '/crm/followups',
  /** the shortest honest answer to "what do I do now?" */
  today: () => '/crm/today',
};

/** how the list is narrowed. Every field optional — an empty filter is
    everyone, which is what the layer opens on. */
export interface PeopleFilter {
  kind?: PersonKind;
  stage?: string;
  segment?: string;
  pipeline?: string;
  warmth?: string;
  tag?: string;
  company?: string;
  /** the door they came in through */
  source?: string;
  /** only the people something is actually owed to */
  owes?: boolean;
  q?: string;
  limit?: number;
  cursor?: string;
}

/** finish a floor's setup — the graph and the lock both change behind this */
export async function completeOnboarding(sid: string, answers: Record<string, string>) {
  const res = await post<OnboardingResult>(paths.onboarding(sid), { answers });
  invalidate(`/surfaces/${sid}`); // the surface, its brain and its lock all moved
  return res;
}

/** where a surface lives — the workspace is the root, services are slugs.
    Mirrors the `href` the API returns from /surfaces. A direction is not a
    surface: its href comes from /directions, which the caller has. */
export const surfaceHref = (sid: string) =>
  sid === 'workspace' ? '/' : sid === 'crm' ? '/people' : `/${sid}`;

/** pull a surface's page data down before navigating into it */
export function warmSurface(sid: string, direction = false) {
  // the people layer is neither a surface nor a direction — it's the book
  // underneath both, and it reads its own endpoints
  if (sid === 'crm') {
    prefetch(paths.crm());
    prefetch(paths.people());
    return;
  }
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

/* ---- the people layer ---- */

/** everything a write to one person disturbs: the record, its journey, and
    every count that was derived from where they stood */
function invalidatePerson(pid: string) {
  invalidate(paths.person(pid));
  invalidate(paths.journey(pid));
  invalidate('/crm'); // the page, the lists, the pipelines and the segments
  invalidate('/surfaces'); // the funnel, the ladder and the radar read the same book
}

/** move someone. Writes a touch, so the move joins the journey rather than
    quietly editing a field. */
export async function movePersonStage(pid: string, stageId: string, note = '') {
  const person = await post<PersonDetail>(`/crm/people/${pid}/stage`, { stageId, note });
  invalidatePerson(pid);
  return person;
}

/** a call you made, a note you took — the founder's own move, on the same
    trail as the agent's */
export async function logTouch(pid: string, text: string, kind: TouchKind = 'note') {
  const touch = await post<Touch>(`/crm/people/${pid}/touches`, { kind, text, by: 'you' });
  invalidatePerson(pid);
  return touch;
}

export async function addPerson(body: {
  name: string;
  email?: string;
  phone?: string;
  kinds?: PersonKind[];
  company?: string;
  note?: string;
}) {
  const person = await post<Person>('/crm/people', body);
  invalidate('/crm');
  return person;
}

export interface PersonEdit {
  name?: string;
  email?: string;
  phone?: string;
  tags?: string[];
  note?: string;
}

/** edit the record itself. Tags are how a hand-picked group becomes a
    segment: a segment is a rule, so the rule needs something to match on. */
export async function patchPerson(pid: string, body: PersonEdit) {
  const person = await patch<Person>(`/crm/people/${pid}`, body);
  invalidatePerson(pid);
  return person;
}

export async function createSegment(label: string, rule: Partial<SegmentRule>, note = '') {
  const segment = await post<Segment>('/crm/segments', { label, rule, note });
  invalidate('/crm');
  return segment;
}

/** what the file would do, before it does it. Nothing is stored by this. */
export const previewImport = (csv: string, mapping?: Record<string, string>) =>
  post<ImportPreview>('/crm/import/preview', { csv, mapping: mapping ?? {} });

export async function importPeople(body: {
  csv: string;
  mapping?: Record<string, string>;
  kind?: PersonKind;
  onDuplicate?: 'merge' | 'skip';
  segmentLabel?: string;
}) {
  const res = await post<ImportResult>('/crm/import', body);
  invalidate('/crm');
  invalidate('/surfaces');
  return res;
}

export async function openDeal(body: {
  title: string;
  value: number;
  personId?: string;
  stageId?: string;
  expectedClose?: string;
  note?: string;
}) {
  const made = await post<Deal>('/crm/deals', body);
  if (body.personId) invalidatePerson(body.personId);
  else invalidate('/crm');
  return made;
}

/** Take a move. This is the hinge: an agent or an expert gets a real work
    item that lands in the work list and comes back for approval; keeping it
    gets you a follow-up with a date that can go overdue. */
export async function takeMove(pid: string, moveId: string, by: TouchBy, due?: string) {
  const res = await post<MoveResult>(`/crm/people/${pid}/moves/${moveId}`, { by, due });
  invalidatePerson(pid);
  invalidate('/surfaces'); // a dispatched move is a new row in the work list
  return res;
}

/** commit yourself to something, by a date. The one thing an agent can't do
    for you is decide you'll call someone Thursday. */
export async function addFollowup(pid: string, what: string, due?: string) {
  const f = await post<Followup>(`/crm/people/${pid}/followups`, { what, due, by: 'you' });
  invalidatePerson(pid);
  return f;
}

/** done with it, or push it. Pushing keeps it open on purpose. */
export async function setFollowup(
  fid: string,
  personId: string,
  body: { state?: Followup['state']; due?: string },
) {
  const f = await patch<Followup>(`/crm/followups/${fid}`, body);
  invalidatePerson(personId);
  return f;
}

/** advance, win or lose one. Winning moves the person to paying too — the
    two were never separate facts. */
export async function advanceDeal(
  did: string,
  body: { stageId?: string; state?: Deal['state']; value?: number; note?: string },
) {
  const deal = await patch<Deal>(`/crm/deals/${did}`, body);
  if (deal.personId) invalidatePerson(deal.personId);
  else invalidate('/crm');
  return deal;
}
