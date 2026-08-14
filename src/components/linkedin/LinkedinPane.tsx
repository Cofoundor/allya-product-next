'use client';

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { ApiError } from '@/lib/api/client';
import {
  cancelPost,
  deletePost,
  disconnectAccount,
  getAccounts,
  getDraftPosts,
  getPublishedPosts,
  getScheduledPosts,
  isHeld,
  isLive,
  linkedinConfigured,
  outcomeMessage,
  startConnection,
  type LinkedinAccount,
  type LinkedinDraft,
  type LinkedinPost,
} from '@/lib/api/linkedin';

/* ============================================================
   The right-hand pane for the one channel that publishes by itself.

   Everything here is the real backend. That changes what the pane owes
   the founder: the other channels stop at a database row a human picks
   up, so "scheduled" is a promise. Here it is a post that will appear
   on a real feed under a real name whether or not anyone is watching —
   so the hold, the cancel, the delete and the sixty-day credential are
   all on screen rather than implied.

   Three sections, because a post is in one of three places and they are
   not the same question. Being written is mid-interview and nothing has
   been approved. Waiting is approved and coming. Out is out, and the
   only thing left to do to it is take it down.
   ============================================================ */

const when = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
};

/** How long is left on the hold, said the way a founder would say it. */
function holdLeft(iso: string): string | null {
  const ms = new Date(iso).getTime() - Date.now();
  if (Number.isNaN(ms) || ms <= 0) return null;
  const minutes = Math.round(ms / 60000);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr`;
  return `${Math.round(hours / 24)} days`;
}

/* The consent sends the founder back here with an outcome on the URL.
   Reading it as an external store rather than in an effect keeps the
   server snapshot and the first client paint honest with each other —
   the query string is not something React can know while rendering on
   the server, and it never changes under us afterwards. */
const NEVER_CHANGES = () => () => {};
const readOutcome = () => new URL(window.location.href).searchParams.get('linkedin');
const noOutcome = () => null;

type Loaded = {
  accounts: LinkedinAccount[];
  scheduled: LinkedinPost[];
  published: LinkedinPost[];
  drafts: LinkedinDraft[];
};

const EMPTY: Loaded = { accounts: [], scheduled: [], published: [], drafts: [] };

export function LinkedinPane() {
  const [data, setData] = useState<Loaded>(EMPTY);
  const [loading, setLoading] = useState(linkedinConfigured);
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  const arrived = useSyncExternalStore(NEVER_CHANGES, readOutcome, noOutcome);
  const [said, setSaid] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const notice = said ?? (dismissed ? null : outcomeMessage(arrived));

  useEffect(() => {
    if (!linkedinConfigured) return;
    let alive = true;
    /* One failure should not blank the others: these are independent
       reads and a founder with no drafts still wants to see what is out.
       Accounts is the exception — it is the answer to "are you
       connected", and every other list is meaningless without it. */
    Promise.all([
      getAccounts().catch((e: unknown) => (e instanceof ApiError ? e : new ApiError(0, 'Request failed'))),
      getScheduledPosts().catch(() => [] as LinkedinPost[]),
      getPublishedPosts().catch(() => [] as LinkedinPost[]),
      getDraftPosts().catch(() => [] as LinkedinDraft[]),
    ])
      .then(([accounts, scheduled, published, drafts]) => {
        if (!alive) return;
        if (accounts instanceof ApiError) {
          setError(accounts);
          setData(EMPTY);
          return;
        }
        setError(null);
        setData({ accounts, scheduled, published, drafts });
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [nonce]);

  const reload = useCallback(() => {
    setLoading(true);
    setNonce((n) => n + 1);
  }, []);

  const connect = useCallback(() => {
    setBusy('connect');
    startConnection()
      .then((c) => {
        // leaves the app entirely; LinkedIn sends them back to the callback
        window.location.assign(c.authorization_url);
      })
      .catch((e: unknown) => {
        setBusy(null);
        setSaid(e instanceof ApiError ? e.message : 'Could not start the connection.');
      });
  }, []);

  const act = useCallback(
    (key: string, run: () => Promise<{ status: string }>) => {
      setBusy(key);
      run()
        .then((r) => {
          setSaid(r.status);
          reload();
        })
        .catch((e: unknown) => {
          setSaid(e instanceof ApiError ? e.message : 'That did not work.');
        })
        .finally(() => setBusy(null));
    },
    [reload],
  );

  // ---- the state before there is anything to talk to ----

  if (!linkedinConfigured) {
    return (
      <>
        <div className="work-head">
          <h2>The work</h2>
          <span className="split-note">not wired up</span>
        </div>
        <div className="es-down li-unwired">
          <p>
            This build has no LinkedIn backend address, so nothing here would be real. Set{' '}
            <code>NEXT_PUBLIC_LINKEDIN_API_URL</code>{' '}
            to the publishing backend&rsquo;s origin and rebuild.
          </p>
        </div>
      </>
    );
  }

  const { accounts, scheduled, published, drafts } = data;
  const live = accounts.filter((a) => a.author_state === 'CONNECTED');
  const canPost = live.filter((a) => a.author_can_post);
  const attention = live.filter(
    (a) => a.grant_state === 'EXPIRING' || a.grant_state === 'EXPIRED' || !a.author_can_post,
  );

  return (
    <>
      <div className="work-head">
        <h2>The work</h2>
        <span className="split-note">
          {drafts.length} being written · {scheduled.length} waiting · {published.length} out
        </span>
      </div>

      {notice ? (
        <div className="li-notice" role="status">
          <span>{notice}</span>
          <button
            type="button"
            className="link-btn"
            onClick={() => {
              setSaid(null);
              setDismissed(true);
            }}
          >
            Dismiss
          </button>
        </div>
      ) : null}

      {error ? (
        <div className="es-down">
          <p>
            {error.offline
              ? 'Can’t reach the publishing backend — everything in this pane is live data.'
              : error.status === 401 || error.status === 403
                ? 'You’re not signed in to the publishing backend, so it won’t say what’s connected.'
                : error.message}
          </p>
          <button type="button" className="cta" onClick={reload}>
            Try again
          </button>
        </div>
      ) : null}

      {/* ---- who you can speak as ---- */}
      <section className="es-section">
        <div className="es-section-head">
          <h3>Posting as</h3>
          <span>
            {loading
              ? 'reading…'
              : canPost.length
                ? `${canPost.length} account${canPost.length === 1 ? '' : 's'}${
                    attention.length ? ` · ${attention.length} needs you` : ''
                  }`
                : 'nobody yet'}
          </span>
        </div>
        <div className="es-section-scroll">
          {live.map((a) => (
            <div className={`li-account${a.author_can_post ? '' : ' is-stalled'}`} key={a.author_id}>
              <span className="li-account-top">
                <span className="es-row-t">{a.author_name}</span>
                <span className={`es-pill li-${a.grant_state.toLowerCase()}`}>
                  {a.author_kind === 'PERSON' ? 'you' : 'page'}
                </span>
              </span>
              <span className="es-row-m">{a.note}</span>
              <span className="li-account-foot">
                <span className="li-expiry">
                  {a.grant_state === 'EXPIRED'
                    ? 'expired'
                    : `${a.grant_days_until_expiry} day${
                        a.grant_days_until_expiry === 1 ? '' : 's'
                      } left`}
                </span>
                <button
                  type="button"
                  className="link-btn"
                  disabled={busy === a.author_id}
                  onClick={() => act(a.author_id, () => disconnectAccount(a.author_id))}
                >
                  {busy === a.author_id ? 'disconnecting…' : 'Disconnect'}
                </button>
              </span>
            </div>
          ))}

          {!loading && !live.length && !error ? (
            <p className="es-empty">
              Nothing is connected, so nothing can go out. Connecting takes one click and lasts
              sixty days.
            </p>
          ) : null}

          <button type="button" className="es-create" disabled={busy === 'connect'} onClick={connect}>
            <span className="es-create-plus">+</span>{' '}
            {busy === 'connect'
              ? 'opening LinkedIn…'
              : live.length
                ? 'Connect another account'
                : 'Connect LinkedIn'}
          </button>
        </div>
      </section>

      {/* ---- mid-interview ---- */}
      {drafts.length ? (
        <section className="es-section">
          <div className="es-section-head">
            <h3>Being written</h3>
            <span>nothing here has been approved</span>
          </div>
          <div className="es-section-scroll">
            {drafts.map((d) => (
              <div className="es-row" key={d.post_generated_id}>
                <span className="es-row-t">{d.post_generated_name}</span>
                <span className="es-row-m">
                  {d.post_generated_qna_completed_or_not
                    ? 'waiting on your review'
                    : `${d.post_generated_questions_answered} of ${d.post_generated_questions_total} answered`}
                </span>
                <span className="es-pill s-draft">
                  {d.post_generated_qna_completed_or_not ? 'needs you' : 'writing'}
                </span>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {/* ---- approved and coming ---- */}
      <section className="es-section">
        <div className="es-section-head">
          <h3>Waiting to go out</h3>
          <span>{loading ? 'reading…' : 'cancel while the hold is running'}</span>
        </div>
        <div className="es-section-scroll">
          {scheduled.map((p) => {
            const left = holdLeft(p.post_scheduled_datetime);
            return (
              <div className="es-row li-post" key={p.post_id}>
                <span className="es-row-t">{p.post_name}</span>
                <span className="es-row-m">
                  {when(p.post_scheduled_datetime)}
                  {left ? ` · ${left} to change your mind` : ' · going out now'}
                </span>
                <p className="li-commentary">{p.post_commentary}</p>
                <span className="li-post-foot">
                  <span className={`es-pill s-${p.post_status.toLowerCase()}`}>
                    {p.post_status === 'HELD' ? 'held' : 'publishing'}
                  </span>
                  {isHeld(p) ? (
                    <button
                      type="button"
                      className="link-btn"
                      disabled={busy === p.post_id}
                      onClick={() => act(p.post_id, () => cancelPost(p.post_id))}
                    >
                      {busy === p.post_id ? 'pulling it back…' : 'Cancel'}
                    </button>
                  ) : (
                    <span className="li-expiry">too late to cancel</span>
                  )}
                </span>
              </div>
            );
          })}
          {!loading && !scheduled.length ? (
            <p className="es-empty">Nothing is waiting. Ask Allya for a post.</p>
          ) : null}
        </div>
      </section>

      {/* ---- out on a real feed ---- */}
      <section className="es-section">
        <div className="es-section-head">
          <h3>Out on LinkedIn</h3>
          <span>{loading ? 'reading…' : `${published.length} published`}</span>
        </div>
        <div className="es-section-scroll">
          {published.map((p) => (
            <div className="es-row li-post" key={p.post_id}>
              <span className="es-row-t">{p.post_name}</span>
              <span className="es-row-m">{when(p.post_scheduled_datetime)}</span>
              <p className="li-commentary">{p.post_commentary}</p>
              <span className="li-post-foot">
                <span className={`es-pill s-${p.post_status.toLowerCase()}`}>
                  {p.post_status.toLowerCase()}
                </span>
                {isLive(p) ? (
                  <button
                    type="button"
                    className="link-btn"
                    disabled={busy === p.post_id}
                    onClick={() => {
                      if (
                        !window.confirm(
                          'Delete this from LinkedIn? Some people will already have seen it.',
                        )
                      )
                        return;
                      act(p.post_id, () => deletePost(p.post_id));
                    }}
                  >
                    {busy === p.post_id ? 'deleting…' : 'Delete'}
                  </button>
                ) : null}
              </span>
            </div>
          ))}
          {!loading && !published.length ? (
            <p className="es-empty">Nothing has gone out yet.</p>
          ) : null}
        </div>
      </section>

      {/* The one number this channel deliberately does not invent. */}
      <p className="es-fineprint">
        Numbers only exist for company pages — LinkedIn does not report on your own posts, so this
        shows nothing rather than something made up.
      </p>
    </>
  );
}
