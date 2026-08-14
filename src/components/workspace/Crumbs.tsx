'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { BackIcon } from '@/components/icons';

/* ============================================================
   The top-left corner, on every page.

   The lamp and the name are the way home — click Allya and you're back at
   the whole company, from any depth. Next to it the page says where it
   sits: Company / Marketing / Email. Every segment but the last one you're
   standing on is a link back up a level.

   Back is one of those levels, promoted to a button. It goes *up*, not
   backwards through history: where you came from is an accident of how you
   got here, but the level above a page is the same every time, and a
   deep-linked person or a shared campaign has no history to go back to.
   ============================================================ */

export type Crumb = { label: string; href?: string };

/** the nearest ancestor that is somewhere you can stand */
function parentOf(trail: Crumb[]): Crumb | null {
  for (let i = trail.length - 2; i >= 0; i -= 1) {
    if (trail[i].href) return trail[i];
  }
  return null;
}

export function BrandCrumbs({
  trail = [],
  back,
  children,
}: {
  /** where this page sits, root first. The last entry is the page itself. */
  trail?: Crumb[];
  /** override the target — for a page whose parent isn't in its own trail */
  back?: Crumb | null;
  /** anything that rides along with the corner — the page switcher, a flag */
  children?: ReactNode;
}) {
  /* `back === null` is a page that is the top of its own world and says so;
     `undefined` just means nobody passed an opinion, so read the trail. */
  const up = back === undefined ? parentOf(trail) : back;

  return (
    <div className="brand">
      {up?.href ? (
        <Link className="crumb-back" href={up.href} aria-label={`Back to ${up.label}`}>
          <BackIcon />
          <span>Back</span>
        </Link>
      ) : null}

      <Link className="brand-home" href="/" aria-label="Allya — back to the whole company">
        <span className="lamp" />
        Allya
      </Link>

      {trail.length ? (
        <nav className="crumbs" aria-label="Breadcrumb">
          {trail.map((c, i) => {
            const here = i === trail.length - 1;
            return (
              <span className="crumb" key={`${c.label}-${i}`}>
                {i ? (
                  <span className="crumb-sep" aria-hidden="true">
                    /
                  </span>
                ) : null}
                {c.href && !here ? (
                  <Link href={c.href}>{c.label}</Link>
                ) : (
                  <b aria-current={here ? 'page' : undefined}>{c.label}</b>
                )}
              </span>
            );
          })}
        </nav>
      ) : null}

      {children}
    </div>
  );
}
