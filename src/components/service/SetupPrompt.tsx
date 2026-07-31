'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { Lock } from '@/lib/api/types';

/* What stops an action on a floor that isn't set up yet. The floor itself is
   readable — this only appears when you try to make something happen on it. */
export function SetupPrompt({
  lock,
  surfaceId,
  onClose,
}: {
  lock: Lock | null;
  surfaceId: string;
  onClose: () => void;
}) {
  const router = useRouter();

  useEffect(() => {
    if (!lock) return;
    router.prefetch(`/${surfaceId}/onboarding`);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [lock, surfaceId, router, onClose]);

  if (!lock) return null;

  return (
    <div className="setup-layer">
      <div className="setup-wash" onClick={onClose} />
      <section className="setup-card rise-in" role="dialog" aria-modal="true" aria-label={lock.title}>
        <span className="brain-live" />
        <h2>{lock.title}</h2>
        <p>{lock.blurb}</p>
        <div className="setup-act">
          <button type="button" className="cta" onClick={() => router.push(`/${surfaceId}/onboarding`)}>
            {lock.cta}
          </button>
          <button type="button" className="c-later" onClick={onClose}>
            Keep looking around
          </button>
        </div>
      </section>
    </div>
  );
}
