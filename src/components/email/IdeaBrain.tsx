'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { BrainCanvas } from '@/components/BrainCanvas';
import { DotPage } from '@/components/workspace/DotPage';
import { useTimers } from '@/lib/hooks';
import { prefersReducedMotion } from '@/lib/spring';
import { markLaunch, takeLaunch } from '@/components/surface/launch';
import { GROUPS, branchTints, type BrainHandle, type NodeSpec, type OpenNodeInfo } from '@/lib/brain';
import { branchTints as tintsOf } from '@/lib/brain';
import type { ChannelPage, Idea, WorkItem } from '@/lib/api/types';

/* ============================================================
   The brain, one direction deep.

   Same shape as a floor, one level further down: email sits low with a
   single strand running back to marketing underneath it — that one cord
   is what keeps this the same brain and not a second one — and its
   thoughts are thrown up across the rest of the box.

   You arrive here mid-flight. Tapping email on the marketing floor dives
   into the dot; this picks that dive up on the other side and the
   thoughts open out of the anchor one at a time.
   ============================================================ */

export function IdeaBrain({
  channelId,
  page,
  ideas,
  work,
  loading,
  onWrite,
  onReady,
}: {
  channelId: string;
  /** the channel's own copy and hue — none of it lives in the client */
  page: ChannelPage | null;
  ideas: Idea[];
  work: WorkItem[];
  loading: boolean;
  /** a thought's box says "write this campaign" — this is that */
  onWrite: (idea: Idea) => void;
  onReady?: (h: BrainHandle) => void;
}) {
  const router = useRouter();
  const brainRef = useRef<BrainHandle | null>(null);
  const introFor = useRef<BrainHandle | null>(null);
  const [dot, setDot] = useState<OpenNodeInfo | null>(null);
  /** folded away: the box shrinks to its header and the loop stops */
  const [small, setSmall] = useState(false);
  /** once you've touched the button, the page stops deciding for you */
  const touched = useRef(false);
  const flying = useRef(false);
  const { after, clearAll } = useTimers();

  // the direction's own hue: the floor's branch tint the channel names
  /** the floor this direction hangs off — its hue, its cord, its way back */
  const floorId = page?.surfaceId ?? 'marketing';
  const floorHue = GROUPS[floorId] ?? GROUPS.marketing;
  const accent = useMemo(
    () => tintsOf(floorHue)[page?.ui.tint ?? 'b4'] ?? floorHue,
    [floorHue, page?.ui.tint],
  );
  const tints = useMemo(() => branchTints(accent), [accent]);

  /* the cord below goes somewhere: tapping marketing dives out of this
     direction and back up to the floor, the same flight in reverse */
  const leave = useCallback(() => {
    if (flying.current) return;
    flying.current = true;
    const back = page?.ui.backHref ?? '/';
    const go = () => {
      markLaunch(floorId);
      router.push(back);
    };
    if (brainRef.current) brainRef.current.launchInto(floorId, go);
    else go();
  }, [floorId, page?.ui.backHref, router]);

  /* the floor (tier 0) — this direction (tier 1, the anchor) — a thought
     per idea (tier 2) — what each one is made of (tier 3). Everything but
     the cord starts hidden, and the intro grows it. */
  const nodes = useMemo<NodeSpec[]>(() => {
    const out: NodeSpec[] = [
      {
        id: floorId,
        label: page?.ui.floorLabel ?? '…',
        tier: 0,
        group: floorId,
        surface: floorId,
      },
      { id: channelId, label: page?.label ?? '…', tier: 1, group: channelId, parent: floorId },
    ];
    ideas.forEach((idea, i) => {
      const tint = `b${(i % 8) + 1}`;
      out.push({
        id: idea.id,
        label: idea.label,
        tier: 2,
        group: tint,
        parent: channelId,
        hidden: true,
        work: idea.work ?? undefined,
        // an idea nobody has started is drawn faintly — that IS its status
        provisional: idea.state === 'idea',
      });
      idea.moves.forEach((m) =>
        out.push({
          id: m.id,
          label: m.label,
          tier: 3,
          group: tint,
          parent: idea.id,
          hidden: true,
          provisional: idea.state === 'idea',
        }),
      );
    });
    return out;
  }, [channelId, floorId, ideas, page?.label, page?.ui.floorLabel]);

  /* a tapped dot reports its parent by LABEL, not id (that's what the sheet
     shows), so a thought's details have to be findable both ways */
  const byId = useMemo(() => new Map(ideas.map((i) => [i.id, i])), [ideas]);
  const byLabel = useMemo(() => new Map(ideas.map((i) => [i.label, i])), [ideas]);

  /* The box takes 460ms to travel between its two heights. The loop has
     to outlive that — stopping it on the first frame freezes the graph
     mid-fold, which is the jump you see rather than a fold. Opening is
     the reverse: start it first, then take one clean resize at the end so
     it's sharp at the new size instead of waiting for the next probe. */
  const FOLD_MS = 460;
  const fold = useCallback(
    (next: boolean) => {
      setSmall(next);
      const h = brainRef.current;
      if (!h) return;
      const still = prefersReducedMotion();
      if (next) {
        if (still) h.stop();
        else after(FOLD_MS + 60, () => h.stop());
      } else {
        h.start();
        if (!still) after(FOLD_MS + 60, () => h.resize());
      }
    },
    [after],
  );

  /* It opens, then it folds itself away. You see the graph grow — which
     is the point of arriving here — and then it gets out of the way of
     the work underneath. Touch the button once and this never fires. */
  const autoFold = useCallback(() => {
    if (touched.current) return;
    fold(true);
  }, [fold]);

  /* the arrival: land the flight, then open the thoughts out of the anchor */
  const runIntro = useCallback(
    (h: BrainHandle) => {
      if (introFor.current === h) return;
      introFor.current = h;
      clearAll();

      const thoughts = nodes.filter((n) => n.tier === 2).map((n) => n.id);
      const leaves = nodes.filter((n) => n.tier === 3).map((n) => n.id);

      if (prefersReducedMotion()) {
        [...thoughts, ...leaves].forEach((id) => h.reveal(id));
        h.frame(null, 1, true);
        after(900, autoFold);
        return;
      }

      h.setThoughts(false);
      const flew = takeLaunch(channelId);
      if (flew) h.arriveInto(channelId);
      else h.frame(null, 1, true);

      const start = flew ? 220 : 420;
      thoughts.forEach((id, i) =>
        after(start + i * 95, () => {
          h.reveal(id);
          h.pulse(id);
        }),
      );
      const leafAt = start + thoughts.length * 95 + 140;
      leaves.forEach((id, i) =>
        after(leafAt + i * 32, () => {
          h.reveal(id);
          if (i % 3 === 0) h.pulse(id);
        }),
      );
      after(leafAt + leaves.length * 32 + 400, () => h.setThoughts(true));
      // long enough to watch it finish arriving, short enough not to wait
      after(leafAt + leaves.length * 32 + 1900, autoFold);
    },
    [after, autoFold, channelId, clearAll, nodes],
  );

  const closeDot = useCallback(() => {
    setDot(null);
    brainRef.current?.clearFocus();
  }, []);

  const ideaOf = (info: OpenNodeInfo) =>
    byId.get(info.id) ?? (info.parent ? byLabel.get(info.parent) : undefined);

  return (
    <>
      {/* The header lives outside the graph's box, and the box's own height
          never changes — folding collapses the row it sits in. The engine
          writes to that box on every resize, so anything animating its
          height gets restarted frame after frame and never moves. */}
      <section className={`c-sec es-brain${small ? ' is-min' : ''}`}>
        <div className="brain-head es-brain-head">
          <span className="brain-title">
            <span className="brain-live" /> {page?.ui.brainTitle ?? 'The brain'}
          </span>
          <span className="brain-side">
            <span className="brain-sub">
              {loading
                ? 'reading the channel…'
                : small
                  ? `${ideas.length} thoughts, folded away`
                  : `${ideas.length} thoughts — ${page?.ui.brainSubtitle ?? 'touch one'}`}
            </span>
            <button
              type="button"
              className="es-fold"
              aria-expanded={!small}
              aria-label={small ? 'Open the brain' : 'Minimise the brain'}
              onClick={() => {
                touched.current = true;
                fold(!small);
              }}
            >
              {small ? '▢' : '—'}
            </button>
          </span>
        </div>

        <div className="es-brain-body">
          {/* the grid item must not carry a height of its own, or the row
              has nothing to collapse — the graph's box keeps its size in
              here, and this clips it */}
          <div className="es-brain-clip">
            <BrainCanvas
            key={ideas.map((i) => i.id).join('|')}
            boxClassName="es-brain-canvas"
        onReady={(h) => {
          brainRef.current = h;
          onReady?.(h);
          runIntro(h);
        }}
        options={{
          nodes,
          layout: 'spray',
          anchorId: channelId,
          revealed: true,
          accent,
          groupColors: tints,
          thoughtEvery: 3.4,
          leafSpread: 0.15,
          leafReach: 0.94,
          radii: { 0: 5.6, 1: 8.2, 2: 4.6, 3: 2.9 },
          isLive: (n) => !!n.work && work.some((w) => w.id === n.work && w.status === 'needs-you'),
          onOpenNode: setDot,
          onLaunch: leave,
        }}
            />
          </div>
        </div>
      </section>

      <DotPage
        info={dot}
        work={work}
        branchWord="campaign"
        leafWord="detail"
        deptCopy={{}}
        blurbFor={(n) => ideaOf(n)?.note ?? null}
        // the button is the door into the conversation, whatever was tapped
        ctaFor={(n) => (ideaOf(n) ? 'Write this campaign →' : 'Talk to Allya about this →')}
        deepLink={(n) =>
          n.id === channelId
            ? {
                href: page?.ui.backHref ?? '/',
                label: page?.ui.backLabel ?? 'Back',
                note: 'this is one of its directions — the cord below is the same brain',
              }
            : null
        }
        onClose={closeDot}
        onGoto={(id) => brainRef.current?.openNode(id)}
        onAsk={() => {
          const idea = dot ? ideaOf(dot) : undefined;
          closeDot();
          if (idea) onWrite(idea);
        }}
      />
    </>
  );
}
