'use client';

import { createContext, useCallback, useContext, useMemo, useState } from 'react';

/* ============================================================
   Opening a person, from anywhere.

   The whole promise of the layer is that a person lives in one place, so
   the record can't belong to the page that happens to be showing. A
   campaign's audience, a work item, a day on the calendar and a band on
   the funnel all open the same sheet, and none of them changes route to
   do it.

   The provider owns which id is open; PersonSheet renders it. Anything
   that can name a person calls openPerson().
   ============================================================ */

interface PersonSheetApi {
  /** who's open, or null */
  personId: string | null;
  openPerson: (id: string) => void;
  closePerson: () => void;
}

const Ctx = createContext<PersonSheetApi | null>(null);

export function PersonSheetProvider({
  children,
  initialId = null,
}: {
  children: React.ReactNode;
  /** a deep link — open with this record already up. Initial state rather
      than an effect, so the sheet is there on the first paint. */
  initialId?: string | null;
}) {
  const [personId, setPersonId] = useState<string | null>(initialId);
  const openPerson = useCallback((id: string) => setPersonId(id), []);
  const closePerson = useCallback(() => setPersonId(null), []);
  const value = useMemo(
    () => ({ personId, openPerson, closePerson }),
    [personId, openPerson, closePerson],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Outside a provider this is a no-op rather than a throw: a surface that
    hasn't opted into the layer yet should render, not crash. */
export function usePersonSheet(): PersonSheetApi {
  const ctx = useContext(Ctx);
  const fallback = useMemo<PersonSheetApi>(
    () => ({ personId: null, openPerson: () => {}, closePerson: () => {} }),
    [],
  );
  return ctx ?? fallback;
}
