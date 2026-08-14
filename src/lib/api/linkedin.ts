/* ============================================================
   The LinkedIn backend, which is not the product API.

   Different service, different origin, and a different way of saying who
   you are: that backend authenticates with an `access_token` cookie it
   sets itself, so every request here goes out with credentials and none
   of them carry the product API's bearer token.

   Everything below mirrors `models/marketing/linkedin.py` field for
   field. The names are the backend's, deliberately — a rename here is a
   place the two can drift apart without anything failing loudly.
   ============================================================ */

import { ApiError } from './client';

/* The backend mounts its routers at the root, so this is an origin with
   no path — `https://host`, not `https://host/api/v1`. */
export const LINKEDIN_API_URL = (process.env.NEXT_PUBLIC_LINKEDIN_API_URL ?? '').replace(/\/+$/, '');

/** No address, no integration. The pane says so rather than looking broken. */
export const linkedinConfigured = LINKEDIN_API_URL !== '';

// ---- what the backend returns ------------------------------------------

export type AuthorKind = 'PERSON' | 'ORGANIZATION';
export type AuthorState = 'CONNECTED' | 'REVOKED';
export type GrantState = 'CONNECTED' | 'EXPIRING' | 'EXPIRED' | 'REVOKED';

/** An author, with the grant's standing folded in — "connected" is
    useless without "expires on Tuesday". */
export interface LinkedinAccount {
  author_id: string;
  author_kind: AuthorKind;
  author_urn: string;
  author_name: string;
  author_role: string | null;
  author_can_post: boolean;
  author_state: AuthorState;
  grant_state: GrantState;
  grant_expires_datetime: string;
  grant_days_until_expiry: number;
  note: string;
}

export interface LinkedinConnection {
  authorization_url: string;
  scopes: string[];
  organization_posting_enabled: boolean;
}

export type PostStatus = 'HELD' | 'PUBLISHING' | 'LIVE' | 'PARTIAL' | 'FAILED' | 'CANCELLED';
export type TargetStatus = 'PENDING' | 'PUBLISHING' | 'LIVE' | 'FAILED' | 'CANCELLED' | 'DELETED';

export interface LinkedinPost {
  post_id: string;
  user_account_id: string;
  post_name: string;
  post_commentary: string;
  post_status: PostStatus;
  post_visibility: 'PUBLIC' | 'CONNECTIONS';
  post_creation_datetime: string;
  post_scheduled_datetime: string;
  post_image_url: string | null;
  post_image_alt_text: string | null;
  post_reshare_to_organization_or_not: boolean;
  post_reshare_delay_minutes: number;
}

export interface LinkedinMetric {
  metric_id: string;
  target_id: string;
  metric_window: 'ONE_HOUR' | 'ONE_DAY' | 'ONE_WEEK';
  metric_observed_datetime: string;
  metric_impressions: number;
  metric_unique_impressions: number;
  metric_clicks: number;
  metric_likes: number;
  metric_comments: number;
  metric_shares: number;
  metric_engagement_rate: number;
}

export interface LinkedinTarget {
  target_id: string;
  post_id: string;
  author_id: string;
  target_author_urn: string;
  target_kind: AuthorKind;
  target_role: 'ORIGINAL' | 'RESHARE';
  target_status: TargetStatus;
  target_scheduled_datetime: string;
  target_share_urn: string | null;
  target_image_urn: string | null;
  target_attempts: number;
  target_last_error: string | null;
  target_published_datetime: string | null;
  metrics: LinkedinMetric[];
}

export interface LinkedinPostDetail extends LinkedinPost {
  targets: LinkedinTarget[];
}

/** Mid-interview. Not a row in the posts table yet, because nothing has
    been approved. */
export interface LinkedinDraft {
  post_generated_id: string;
  post_generated_name: string;
  post_generated_questions_answered: number;
  post_generated_questions_total: number;
  post_generated_qna_completed_or_not: boolean;
  post_generated_commentary: string;
}

export interface LinkedinAction {
  status: string;
}

/** The gate question every channel answers, plus the one LinkedIn adds. */
export interface LinkedinGates {
  onboarding: boolean;
  onboarding_marketing: boolean;
  onboarding_marketing_linkedin: boolean;
  onboarding_marketing_linkedin_account_connected: boolean;
  onboarding_marketing_linkedin_organization_available: boolean;
}

// ---- talking to it ------------------------------------------------------

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  if (!linkedinConfigured) {
    throw new ApiError(0, 'This build has no LinkedIn backend address.');
  }
  const headers: Record<string, string> = {};
  if (body !== undefined) headers['content-type'] = 'application/json';

  let res: Response;
  try {
    res = await fetch(`${LINKEDIN_API_URL}${path}`, {
      method,
      headers,
      // the session lives in a cookie that backend set, on its own origin
      credentials: 'include',
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, "Can't reach the publishing backend.");
  }

  if (!res.ok) {
    const detail = await res
      .json()
      .then((d: { detail?: string }) => d?.detail)
      .catch(() => undefined);
    throw new ApiError(res.status, detail ?? res.statusText ?? 'Request failed');
  }

  /* The list endpoints answer "nothing here" with a 204, which is a
     success with no body — `res.json()` would throw on it. Callers of the
     lists want an empty array, so hand them one. */
  if (res.status === 204) return [] as unknown as T;
  return (await res.json()) as T;
}

/** Start the consent. The URL is LinkedIn's; the state is kept server-side. */
export const startConnection = () =>
  call<LinkedinConnection>('POST', '/marketing/linkedin/connect');

export const getAccounts = () =>
  call<LinkedinAccount[]>('GET', '/marketing/linkedin/accounts');

export const disconnectAccount = (authorId: string) =>
  call<LinkedinAction>('DELETE', `/marketing/linkedin/accounts/${authorId}`);

export const getScheduledPosts = () =>
  call<LinkedinPost[]>('GET', '/marketing/linkedin/get-posts-scheduled');

export const getPublishedPosts = () =>
  call<LinkedinPost[]>('GET', '/marketing/linkedin/get-posts-published');

export const getDraftPosts = () =>
  call<LinkedinDraft[]>('GET', '/marketing/linkedin/get-posts-draft');

export const getPost = (postId: string) =>
  call<LinkedinPostDetail>('GET', `/marketing/linkedin/posts/${postId}`);

/** Pull a post back while the hold is still running. 409 means it has
    already gone out and deleting is the only honest option left. */
export const cancelPost = (postId: string) =>
  call<LinkedinAction>('POST', `/marketing/linkedin/posts/${postId}/cancel`);

/** Take a published post down. Some people will have seen it. */
export const deletePost = (postId: string) =>
  call<LinkedinAction>('DELETE', `/marketing/linkedin/posts/${postId}`);

export const getGates = () =>
  call<LinkedinGates>('GET', '/marketing/linkedin/onboarding-complete-or-not');

// ---- reading what comes back -------------------------------------------

/** What the callback appended to the return URL. */
export type ConnectOutcome = 'connected' | 'declined' | 'failed' | 'expired';

const OUTCOMES: Record<ConnectOutcome, string> = {
  connected: 'LinkedIn is connected.',
  declined: 'You declined on LinkedIn — nothing was connected.',
  failed: "That didn't complete. Try connecting again.",
  expired: 'That took too long and the link expired. Try again.',
};

export function outcomeMessage(value: string | null): string | null {
  return value && value in OUTCOMES ? OUTCOMES[value as ConnectOutcome] : null;
}

/** A post is cancellable only while it is still being held. */
export const isHeld = (post: LinkedinPost) => post.post_status === 'HELD';

/** …and deletable only once something of it is actually on a feed. */
export const isLive = (post: LinkedinPost) =>
  post.post_status === 'LIVE' || post.post_status === 'PARTIAL';
