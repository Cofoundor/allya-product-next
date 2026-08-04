'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { haptic } from '@/lib/spring';
import { useTimers } from '@/lib/hooks';
import { useConversation, type Chip } from '@/lib/useConversation';
import { GROUPS, type BrainHandle } from '@/lib/brain';
import {
  paths,
  approveWork,
  getReview,
  requestRevision,
  sendMessage,
  surfaceHref,
  undoWork,
  warmSurface,
} from '@/lib/api/resources';
import { useResource } from '@/lib/api/useResource';
import type { ApiChip, ApiMessage, BrainGraph, Reply, Review, Surface, WorkList, WorkItem } from '@/lib/api/types';
import { Transcript } from '@/components/Transcript';
import { PressButton } from '@/components/Pressable';
import { Island } from '@/components/workspace/Island';
import { PagePicker } from '@/components/workspace/PagePicker';
import { WorkPane } from '@/components/workspace/WorkPane';
import { Composer } from '@/components/workspace/Composer';
import { ApprovalSheet } from '@/components/workspace/ApprovalSheet';
import { Toast } from '@/components/workspace/Toast';
import { AccountPill } from './AccountPill';
import { SetupPrompt } from '@/components/service/SetupPrompt';
import { SurfaceCanvas } from './SurfaceCanvas';
import { ReviewBody, ReviewHead } from './ReviewSheet';
import { markLaunch } from './launch';

/** the panel's reading order — approving something moves it down the list */
const RANK = { 'needs-you': 0, running: 1, shipped: 2 } as const;

/* ============================================================
   One shell for every surface. The company brain and a service floor are
   the same page with different data: the layout, the graph, the work, the
   words and the script all arrive from /surfaces/{id}.
   ============================================================ */
export default function SurfaceWorkspace({ surfaceId }: { surfaceId: string }) {
  const router = useRouter();
  const surfaceRes = useResource<Surface>(paths.surface(surfaceId));
  const brainRes = useResource<BrainGraph>(paths.brain(surfaceId));
  const workRes = useResource<WorkList>(paths.work(surfaceId));
  const openingRes = useResource<Reply>(paths.conversation(surfaceId));

  // the server owns the list; this session owns whatever it has changed since
  const [changed, setChanged] = useState<Record<string, WorkItem>>({});
  const [engaged, setEngaged] = useState(false);
  const [deferred, setDeferred] = useState(false);
  const [tab, setTab] = useState<'chat' | 'work'>('chat');
  const [sheetCtx, setSheetCtx] = useState<string | null>(null);
  const [review, setReview] = useState<Review | null>(null);
  const [reviewError, setReviewError] = useState<string | undefined>();
  const [toast, setToast] = useState<{ text: string; id: number } | null>(null);
  const [launching, setLaunching] = useState(false);

  const convo = useConversation();
  const { say, think, showChips, clearChips, reset } = convo;
  const { after } = useTimers();
  const inputRef = useRef<HTMLInputElement>(null);
  const toastId = useRef(0);
  const brainRef = useRef<BrainHandle | null>(null);
  const flying = useRef(false);

  const surface = surfaceRes.data;
  // a service floor wears its own colour; the company brain keeps the lime
  const accent = surfaceId === 'workspace' ? null : (GROUPS[surfaceId] ?? null);
  const work = useMemo(
    () =>
      (workRes.data?.items ?? [])
        .map((w) => changed[w.id] ?? w)
        .sort((a, b) => RANK[a.status] - RANK[b.status]),
    [workRes.data, changed],
  );
  const needs = work.filter((w) => w.status === 'needs-you');
  const running = work.filter((w) => w.status === 'running');

  const showToast = useCallback((text: string) => {
    toastId.current += 1;
    setToast({ text, id: toastId.current });
  }, []);

  /* ---- a floor you haven't set up yet ----
     You can read it, walk the brain, open dot pages. The moment you try to
     make something happen — talk to Allya, review, approve — it asks for the
     four answers first. `locked` is false on the workspace and on any floor
     whose onboarding is done. */
  const locked = !!surface && !surface.onboarded;
  const [prompting, setPrompting] = useState(false);
  const gate = useCallback(() => {
    if (!locked) return false;
    setPrompting(true);
    return true;
  }, [locked]);

  const openSheet = useCallback(
    (id: string) => {
      if (gate()) return;
      setSheetCtx(id);
      setReview(null);
      setReviewError(undefined);
      getReview(id)
        .then(setReview)
        .catch(() => setReviewError("Couldn't load this draft."));
    },
    [gate],
  );

  /* ---- the server's words become chat beats, one after another ---- */
  // chips can send a message, and sending is defined further down — the ref
  // keeps the cycle from turning into a dependency loop
  const sendRef = useRef<(text: string) => void>(() => {});

  const playChips = useCallback(
    (chips: ApiChip[]) => {
      if (!chips.length) return clearChips();
      showChips(
        chips.map((c) => ({
          label: c.label,
          act: () => (c.action === 'review' ? openSheet(c.value) : sendRef.current(c.value)),
        })),
      );
    },
    [clearChips, showChips, openSheet],
  );

  const playReply = useCallback(
    (reply: Reply, delay = 900) => {
      const step = (i: number) => {
        if (i >= reply.messages.length) return playChips(reply.chips);
        const m: ApiMessage = reply.messages[i];
        think(() => {
          say(m.speaker, m.text, m.tag ? { tag: <span className="human-tag">{m.tag}</span> } : {});
          step(i + 1);
        }, i === 0 ? delay : 1200);
      };
      step(0);
    },
    [say, think, playChips],
  );

  const sendText = useCallback(
    (text: string) => {
      const t = text.trim();
      if (!t) return;
      if (gate()) return;
      setEngaged(true);
      clearChips();
      say('you', t);
      sendMessage(surfaceId, t)
        .then((r) => playReply(r))
        .catch(() =>
          think(() => say('allya', "I couldn't reach the server just then. Say it again in a moment?"), 600),
        );
    },
    [surfaceId, clearChips, say, think, playReply, gate],
  );

  useEffect(() => {
    sendRef.current = sendText;
  });

  /* ---- opening beats, once the script arrives ---- */
  const seeded = useRef<string | null>(null);
  useEffect(() => {
    const opening = openingRes.data;
    if (!opening || seeded.current === surfaceId) return;
    seeded.current = surfaceId;
    reset();
    opening.messages.forEach((m) =>
      say(m.speaker, m.text, m.tag ? { tag: <span className="human-tag">{m.tag}</span> } : {}),
    );
    playChips(opening.chips);
  }, [openingRes.data, surfaceId, reset, say, playChips]);

  const swap = useCallback((item: WorkItem) => {
    setChanged((c) => ({ ...c, [item.id]: item }));
  }, []);

  const onApprove = useCallback(
    (wid: string) => {
      haptic([12, 40, 18]);
      setSheetCtx(null);
      approveWork(wid)
        .then((res) => {
          after(240, () => {
            swap(res.item);
            showToast(res.toast);
            say('you', 'Approved');
            playReply(res.reply, 700);
          });
        })
        .catch(() => showToast("Couldn't reach the server — nothing was approved."));
    },
    [after, swap, showToast, say, playReply],
  );

  const onUndo = useCallback(
    (wid: string) => {
      undoWork(wid)
        .then((res) => {
          haptic([10]);
          swap(res.item);
          showToast(res.toast);
          say('you', 'Undo that');
          playReply(res.reply, 600);
        })
        .catch(() => showToast("Couldn't reach the server — it's still out."));
    },
    [swap, showToast, say, playReply],
  );

  const onEdit = useCallback(
    (wid: string) => {
      setSheetCtx(null);
      requestRevision(wid)
        .then((r) =>
          after(240, () => {
            say('you', 'Ask for a change');
            playReply(r, 700);
          }),
        )
        .catch(() => showToast("Couldn't reach the server."));
    },
    [after, say, playReply, showToast],
  );

  /* ---- leaving: fly into the node, then change route ---- */
  const onLaunch = useCallback(
    (nodeId: string, service: string) => {
      // the node you're already standing on is scenery, not a destination
      if (flying.current || service === surfaceId) return;
      flying.current = true;
      setLaunching(true);
      warmSurface(service); // the arrival shouldn't wait on a round trip
      const go = () => {
        markLaunch(service);
        router.push(surfaceHref(service));
      };
      if (brainRef.current) brainRef.current.launchInto(nodeId, go);
      else go();
    },
    [router, surfaceId],
  );

  /* everywhere this brain can fly to is one tap away — have it ready */
  useEffect(() => {
    const nodes = brainRes.data?.nodes ?? [];
    nodes.forEach((n) => {
      if (n.surface && n.surface !== surfaceId) router.prefetch(surfaceHref(n.surface));
    });
  }, [brainRes.data, router, surfaceId]);

  /* ---- ⌘K / "/" focuses the composer ---- */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = document.activeElement === inputRef.current;
      if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || (e.key === '/' && !typing)) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const onChip = useCallback(
    (c: Chip) => {
      clearChips();
      c.act();
    },
    [clearChips],
  );

  const offline = surfaceRes.error?.offline || workRes.error?.offline;

  /* When the server is gone it's gone for the whole page, so one "try again"
     brings all of it back rather than leaving the topbar insisting we're
     still offline while the panes have recovered. */
  const retryAll = useCallback(() => {
    surfaceRes.reload();
    brainRes.reload();
    workRes.reload();
    openingRes.reload();
    seeded.current = null;
  }, [surfaceRes, brainRes, workRes, openingRes]);

  // a slug the backend doesn't know isn't an error state, it's a wrong turn
  if (surfaceRes.error?.status === 404) {
    return (
      <div className="app">
        <div className="nowhere">
          <h1>There&rsquo;s no {surfaceId} floor.</h1>
          <p>Allya doesn&rsquo;t hold anything under that name yet.</p>
          <Link className="cta" href="/">
            Back to the whole company
          </Link>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* the floor wears its own hue: every glow, wash and border on the page
          reads --accent, and the workspace simply doesn't set it */}
      <div
        className={`app${launching ? ' is-launching' : ''}${accent ? ' is-service' : ''}`}
        style={accent ? ({ ['--accent' as string]: accent } as CSSProperties) : undefined}
      >
        <header className="topbar">
          <div className="brand">
            <span className="lamp" /> Allya{' '}
            <span className="date">· {surface?.label ?? '…'}</span>
            <PagePicker />
          </div>
          <nav className="tabs" aria-label="Panes">
            <PressButton
              type="button"
              className={`tab${tab === 'chat' ? ' active' : ''}`}
              pressScale={0.95}
              onClick={() => setTab('chat')}
            >
              Talk
            </PressButton>
            <PressButton
              type="button"
              className={`tab${tab === 'work' ? ' active' : ''}`}
              pressScale={0.95}
              onClick={() => setTab('work')}
            >
              Work {needs.length ? <span className="badge">·{needs.length}</span> : null}
            </PressButton>
          </nav>
          <div className="spacer" />
          <div className="status-line">
            <span className={`pulse${offline ? ' off' : ''}`} />
            <span>
              {offline
                ? 'Server unreachable'
                : `${running.length} ${surface?.statusNoun ?? 'agent'}${running.length === 1 ? '' : 's'} running${
                    needs.length ? ` · ${needs.length} needs you` : ''
                  }`}
            </span>
          </div>
          <button type="button" className="kbd" title="Focus the composer" onClick={() => inputRef.current?.focus()}>
            ⌘K
          </button>
          <AccountPill />
        </header>

        <main className={`workspace${tab === 'work' ? ' show-work' : ''}`}>
          <section className={`pane-chat${engaged ? ' engaged' : ''}`} aria-label="Conversation with Allya">
            <Island
              surfaceId={surfaceId}
              work={work}
              summary={workRes.data?.summary ?? null}
              onOpenWork={openSheet}
            />

            <SurfaceCanvas
              surfaceId={surfaceId}
              surface={surface ?? null}
              brain={brainRes.data}
              brainError={!!brainRes.error}
              onRetryBrain={retryAll}
              work={work}
              deferred={deferred}
              onDefer={setDeferred}
              onOpenSheet={openSheet}
              onAsk={sendText}
              onLaunch={onLaunch}
              onBrainReady={(h) => {
                brainRef.current = h;
              }}
            />

            <Transcript
              className="thread-scroll"
              messages={convo.messages}
              typing={convo.typing}
              chips={convo.chips}
              onChip={onChip}
            >
              <div className="day-mark">Today{surface ? ` · ${surface.label.toLowerCase()}` : ''}</div>
            </Transcript>

            <Composer
              inputRef={inputRef}
              onSend={sendText}
              onEngage={() => setEngaged(true)}
              onDisengage={() => {
                setEngaged(false);
                inputRef.current?.blur();
              }}
              suggestions={surface?.suggestions ?? []}
              placeholder={surface?.placeholder ?? 'Direct Allya…'}
            />
          </section>

          <WorkPane
            work={work}
            loading={workRes.loading}
            error={workRes.error ? "Couldn't load your work." : undefined}
            onRetry={retryAll}
            onOpenSheet={openSheet}
            onUndo={onUndo}
          />
        </main>
      </div>

      <ApprovalSheet
        context={sheetCtx}
        onClose={() => setSheetCtx(null)}
        onApprove={onApprove}
        onEdit={onEdit}
        renderHead={() => <ReviewHead review={review} />}
        renderBody={() => (
          <ReviewBody review={review} error={reviewError} onRetry={() => sheetCtx && openSheet(sheetCtx)} />
        )}
        approveLabel={() => review?.approveLabel ?? 'Approve'}
      />
      <SetupPrompt
        lock={prompting ? (surface?.lock ?? null) : null}
        surfaceId={surfaceId}
        onClose={() => setPrompting(false)}
      />
      <Toast message={toast} onDone={() => setToast(null)} />
    </>
  );
}
