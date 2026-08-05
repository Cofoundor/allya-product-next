'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';

/* ============================================================
   The top-left corner, on every page.

   The lamp and the name are the way home — click Allya and you're back at
   the whole company, from any depth. Next to it the page says where it
   sits: Company / Marketing / Email. Every segment but the last one you're
   standing on is a link back up a level.
   ============================================================ */

export type Crumb = { label: string; href?: string };

export function BrandCrumbs({
  trail = [],
  children,
}: {
  /** where this page sits, root first. The last entry is the page itself. */
  trail?: Crumb[];
  /** anything that rides along with the corner — the page switcher, a flag */
  children?: ReactNode;
}) {
  return (
    <div className="brand">
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
