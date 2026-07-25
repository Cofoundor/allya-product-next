'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

/* The caret next to the date: jump between the pages of the product.
   Click-outside and Escape close it; wherever you are is marked. */

const PAGES = [
  { href: '/', label: 'Workspace', note: 'where the work lives' },
  { href: '/onboarding', label: 'Onboarding', note: 'build your company brain' },
];

export function PagePicker() {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

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
          {PAGES.map((p) => (
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
          ))}
        </div>
      ) : null}
    </div>
  );
}
