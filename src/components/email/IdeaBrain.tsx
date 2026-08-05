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
  const flying = useRef(false);
  const { after, clearAll } = useTimers();

  // the direction's own hue: the floor's branch tint the channel names
  const accent = useMemo(
    () => tintsOf(GROUPS.marketing)[page?.ui.tint ?? 'b4'] ?? GROUPS.marketing,
    [page?.ui.tint],
  );
  const tints = useMemo(() => branchTints(accent), [accent]);

  /* the cord below goes somewhere: tapping marketing dives out of this
     direction and back up to the floor, the same flight in reverse */
  const leave = useCallback(() => {
    if (flying.current) return;
    flying.current = true;
    const back = page?.ui.backHref ?? '/marketing';
    const go = () => {
      markLaunch('marketing');
      router.push(back);
    };
    if (brainRef.current) brainRef.current.launchInto('marketing', go);
    else go();
  }, [page?.ui.backHref, router]);

  /* marketing (tier 0) — email (tier 1, the anchor) — a thought per idea
     (tier 2) — what each one is made of (tier 3). Everything but the cord
     starts hidden, and the intro grows it. */
  const nodes = useMemo<NodeSpec[]>(() => {
    const out: NodeSpec[] = [
      { id: 'marketing', label: 'Marketing', tier: 0, group: 'marketing', surface: 'marketing' },
      { id: channelId, label: page?.label ?? '…', tier: 1, group: channelId, parent: 'marketing' },
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
  }, [channelId, ideas, page?.label]);

  /* a tapped dot reports its parent by LABEL, not id (that's what the sheet
     shows), so a thought's details have to be findable both ways */
  const byId = useMemo(() => new Map(ideas.map((i) => [i.id, i])), [ideas]);
  const byLabel = useMemo(() => new Map(ideas.map((i) => [i.label, i])), [ideas]);

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
    },
    [after, channelId, clearAll, nodes],
  );

  const closeDot = useCallback(() => {
    setDot(null);
    brainRef.current?.clearFocus();
  }, []);

  const ideaOf = (info: OpenNodeInfo) =>
    byId.get(info.id) ?? (info.parent ? byLabel.get(info.parent) : undefined);

  return (
    <>
      <BrainCanvas
        key={ideas.map((i) => i.id).join('|')}
        boxClassName="c-sec brain-box brain-tall"
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
      >
        <div className="brain-head">
          <span className="brain-title">
            <span className="brain-live" /> {page?.ui.brainTitle ?? 'The brain'}
          </span>
          <span className="brain-side">
            <span className="brain-sub">
              {loading ? 'reading the channel…' : `${ideas.length} thoughts — ${page?.ui.brainSubtitle ?? 'touch one'}`}
            </span>
          </span>
        </div>
      </BrainCanvas>

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
                href: page?.ui.backHref ?? '/marketing',
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
