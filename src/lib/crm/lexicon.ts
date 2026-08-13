'use client';

import { useMemo } from 'react';
import { paths } from '@/lib/api/resources';
import { useResource } from '@/lib/api/useResource';
import type { Lexicon, TouchBy, Warmth } from '@/lib/api/types';

/* ============================================================
   The words this interface puts on the API's enums.

   One cached read, shared by every component that needs to say a warmth, a
   touch kind or which of the three ways a move can be taken. Before this,
   each of those components carried its own constant — which is how "never"
   was rendered as "never", "never spoken to" and "never contacted" on three
   different screens.

   Everything returns an empty string until the read lands. That's deliberate:
   a placeholder word would be frontend-owned copy, and the whole point is
   that this screen owns none. Callers render a skeleton or nothing.
   ============================================================ */

export function useLexicon() {
  const res = useResource<Lexicon>(paths.lexicon());
  const lex = res.data;

  return useMemo(() => {
    const warmth = new Map((lex?.warmth ?? []).map((w) => [w.id, w]));
    const dispatch = new Map((lex?.dispatch ?? []).map((d) => [d.id, d]));
    return {
      ready: !!lex,
      /** how the UI says a warmth in a column: "this week", "gone quiet" */
      warmthSaid: (w: Warmth) => warmth.get(w)?.said ?? '',
      /** the same fact with room to breathe: "spoken to this week" */
      warmthSaidFull: (w: Warmth) => warmth.get(w)?.saidFull ?? '',
      /** warmest first, straight from the contract rather than a local order */
      warmthRank: (w: Warmth) => warmth.get(w)?.rank ?? 99,
      touchWord: (kind: string) => lex?.touchKinds[kind] ?? kind,
      urgencyWord: (u: string) => lex?.urgency[u] ?? '',
      /** the three ways a move gets taken, in the order the API lists them */
      dispatch: lex?.dispatch ?? [],
      dispatchWord: (by: TouchBy) => dispatch.get(by) ?? null,
      /** surface id -> the human who covers it, in Allya's words */
      expertOf: (surfaceId: string | undefined) =>
        lex?.experts[surfaceId ?? ''] ?? lex?.experts.workspace ?? '',
    };
  }, [lex]);
}
