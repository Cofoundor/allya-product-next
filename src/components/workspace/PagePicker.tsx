'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { paths } from '@/lib/api/resources';
import { useResource } from '@/lib/api/useResource';
import type { SurfaceSummary } from '@/lib/api/types';

/* The caret next to the date: jump between the floors of the brain. The list
   is whatever the backend says exists — adding a service there adds it here.
   Click-outside and Escape close it; wherever you are is marked. */

const EXTRA = [{ href: '/onboarding', label: 'Onboarding', note: 'build your company brain' }];

export function PagePicker() {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const { data } = useResource<SurfaceSummary[]>(open ? paths.surfaces() : null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setOpen(false);
      }
    };
    document.addEventListener('click', onDoc);
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('click', onDoc);
      document.removeEventListener('keydown', onKey, true);
    };
  }, [open]);

  const pages = [...(data ?? []).map((s) => ({ href: s.href, label: s.label, note: s.note })), ...EXTRA];

  return (
    <div className="pagepick" ref={wrapRef}>
      <button
        type="button"
        className="pagepick-btn"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Go to another page"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
      >
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open ? (
        <div className="pagepick-menu" role="menu">
          {data ? (
            pages.map((p) => (
              <Link
                key={p.href}
                role="menuitem"
                href={p.href}
                className={pathname === p.href ? 'is-here' : undefined}
                onClick={() => setOpen(false)}
              >
                <span className="pp-dot" />
                {p.label}
                <span className="pp-note">{p.note}</span>
              </Link>
            ))
          ) : (
            <div className="sk-list">
              {[0, 1, 2].map((i) => (
                <div className="sk-line" key={i} />
              ))}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
