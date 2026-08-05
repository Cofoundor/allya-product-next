'use client';

import { useMemo, useRef, useState } from 'react';
import { BrainCanvas } from '@/components/BrainCanvas';
import { GROUPS, branchTints, type BrainHandle, type NodeSpec, type OpenNodeInfo } from '@/lib/brain';
import type { Idea } from '@/lib/email-campaign';

/* ============================================================
   The brain, cropped to one job.

   The floor's graph holds all eight directions; this one holds email and
   nothing else. What runs is drawn solid, what's only an idea is drawn
   faint — the graph is the difference between the two. Tapping any of it
   hands the idea to the conversation below, which is the whole point of
   putting it on this page.
   ============================================================ */

const STATE_WORD: Record<Idea['state'], string> = {
  live: 'running',
  draft: 'drafted',
  idea: 'not started',
};

export function IdeaBrain({
  ideas,
  onStart,
  loading,
}: {
  ideas: Idea[];
  /** "write this one" — the idea goes to the composer below */
  onStart: (idea: Idea) => void;
  loading: boolean;
}) {
  const handleRef = useRef<BrainHandle | null>(null);
  const [open, setOpen] = useState<Idea | null>(null);

  // email's own hue: the fourth tint of the marketing floor, the same one
  // the direction wears everywhere else
  const accent = useMemo(() => branchTints(GROUPS.marketing).b4, []);
  const tints = useMemo(() => branchTints(accent), [accent]);

  const nodes = useMemo<NodeSpec[]>(() => {
    const out: NodeSpec[] = [{ id: 'email', label: 'Email', tier: 0, group: 'email' }];
    ideas.forEach((idea, i) => {
      const tint = `b${(i % 8) + 1}`;
      out.push({
        id: idea.id,
        label: idea.label,
        tier: 1,
        group: tint,
        parent: 'email',
        // an idea nobody has started is drawn faintly — that IS its status
        provisional: idea.state === 'idea',
      });
      idea.moves.forEach((m) =>
        out.push({ id: m.id, label: m.label, tier: 2, group: tint, parent: idea.id, provisional: idea.state === 'idea' }),
      );
    });
    return out;
  }, [ideas]);

  const byId = useMemo(() => new Map(ideas.map((i) => [i.id, i])), [ideas]);

  const openInfo = (info: OpenNodeInfo) => {
    // a leaf belongs to its idea — walk up rather than showing a dead panel
    const idea = byId.get(info.id) ?? (info.parent ? byId.get(info.parent) : undefined);
    setOpen(idea ?? null);
  };

  const close = () => {
    setOpen(null);
    handleRef.current?.clearFocus();
  };

  return (
    <section className={`c-sec es-brain${open ? ' is-open' : ''}`} style={{ ['--accent' as string]: accent }}>
      <div className="brain-head">
        <span className="brain-title">
          <span className="brain-live" /> The brain · email
        </span>
        <span className="brain-side">
          <span className="brain-sub">
            {loading ? 'reading the channel…' : `${ideas.length} ideas — touch one to write it`}
          </span>
        </span>
      </div>

      {ideas.length ? (
        <BrainCanvas
          key={ideas.map((i) => i.id).join('|')}
          boxClassName="es-brain-box"
          onReady={(h) => {
            handleRef.current = h;
          }}
          options={{
            nodes,
            layout: 'cluster',
            anchorId: 'email',
            revealed: true,
            accent,
            groupColors: tints,
            leafSpread: 0.2,
            thoughtEvery: 4,
            onOpenNode: openInfo,
          }}
        />
      ) : (
        <div className="es-brain-box es-brain-waiting">
          <p>{loading ? 'Reading what email is doing…' : 'Nothing to draw yet.'}</p>
        </div>
      )}

      {open ? (
        <div className="es-idea" role="dialog" aria-label={open.label}>
          <div className="es-idea-top">
            <span className={`es-pill s-${open.state}`}>{STATE_WORD[open.state]}</span>
            <button type="button" className="es-idea-x" onClick={close} aria-label="Close">
              ×
            </button>
          </div>
          <h3>{open.label}</h3>
          <p>{open.note}</p>
          <div className="es-idea-act">
            <button
              type="button"
              className="cta"
              onClick={() => {
                onStart(open);
                close();
              }}
            >
              Write this one →
            </button>
            <span className="hint">it starts the questions below, already knowing this much</span>
          </div>
        </div>
      ) : null}
    </section>
  );
}
