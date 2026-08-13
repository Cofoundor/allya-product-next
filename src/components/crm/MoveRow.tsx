'use client';

import { useState } from 'react';
import { useLexicon } from '@/lib/crm/lexicon';
import type { Move, TouchBy } from '@/lib/api/types';

/* ============================================================
   A move you can actually take.

   This used to be a <span>. That was the whole problem: a page that lists
   what you could do and gives you no way to do it is a dashboard.

   The fork is the product's own: you don't do the work, you dispatch it —
   but the things only a founder can do (take the call, decide) stay yours.
   So each move asks once, and the answer decides whether a work item lands
   in the work list or a dated follow-up lands on your plate.
   ============================================================ */

/* The verb and the aside for each of the three takers come from
   GET /crm/lexicon: they describe an enum the API owns. */


export function MoveRow({
  move,
  busy,
  expertWord,
  onTake,
}: {
  move: Move;
  busy: boolean;
  /** "your sales expert" — named by discipline, never invented */
  expertWord: string;
  onTake: (by: TouchBy) => void;
}) {
  const [open, setOpen] = useState(false);
  const { dispatchWord } = useLexicon();
  const options = move.does;

  // nothing to choose between: one taker, one tap
  if (options.length === 1) {
    return (
      <button
        type="button"
        className="pl-move"
        disabled={busy}
        onClick={() => onTake(options[0])}
        title={options[0] === 'you' ? move.ownTitle : move.workTitle}
      >
        {move.label}
        <span className="pl-move-by">{options[0] === 'you' ? 'you' : options[0]}</span>
      </button>
    );
  }

  return (
    <span className={`pl-move-wrap${open ? ' is-open' : ''}`}>
      <button
        type="button"
        className="pl-move"
        disabled={busy}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {move.label}
        <span className="pl-move-by">{open ? '▴' : 'who?'}</span>
      </button>
      {open ? (
        <span className="pl-move-menu">
          {options.map((by) => (
            <button
              type="button"
              key={by}
              className="pl-move-opt"
              disabled={busy}
              onClick={() => {
                setOpen(false);
                onTake(by);
              }}
            >
              <span className="pl-move-opt-t">
                {by === 'expert' ? expertWord.replace(/^your /, 'Your ') : (dispatchWord(by)?.verb ?? '')}
              </span>
              <span className="pl-move-opt-n">
                {by === 'you' ? move.ownTitle || (dispatchWord(by)?.note ?? '') : (dispatchWord(by)?.note ?? '')}
              </span>
            </button>
          ))}
        </span>
      ) : null}
    </span>
  );
}
