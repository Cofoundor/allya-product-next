'use client';

import { useState } from 'react';
import { paths } from '@/lib/api/resources';
import { useResource } from '@/lib/api/useResource';
import { usePersonSheet } from '@/lib/crm/personSheet';
import type { Company, Person } from '@/lib/api/types';

/* ============================================================
   Accounts.

   Optional on purpose. A founder selling self-serve has people and no
   companies and shouldn't be made to invent them — so this is a lens on
   the same book rather than a second one, and a company with one person
   in it reads as exactly that.

   Opening a company doesn't open a page: it expands to the people in it,
   and opening one of those opens the same record everything else opens.
   ============================================================ */

const money = (n: number) => `₹${n.toLocaleString('en-IN')}`;

export function CompaniesPane({ onBack }: { onBack: () => void }) {
  const res = useResource<Company[]>(paths.companies());
  const [openId, setOpenId] = useState<string | null>(null);
  const companies = res.data ?? [];

  return (
    <>
      <div className="work-head">
        <h2>Companies</h2>
        <span className="split-note">
          {res.loading ? 'reading…' : `${companies.length} with a name on them`}
        </span>
      </div>

      <button type="button" className="pl-ghost pl-back" onClick={onBack}>
        ← Back to everyone
      </button>
      {/* accounts are a lens on the same book — leaving one shouldn't feel
          like leaving the CRM */}

      {res.error ? (
        <div className="es-down">
          <p>Can’t reach the server — this pane is all live data.</p>
          <button type="button" className="cta" onClick={res.reload}>
            Try again
          </button>
        </div>
      ) : null}

      <section className="es-section">
        <div className="es-section-head">
          <h3>Accounts</h3>
          <span>{companies.reduce((n, c) => n + c.peopleCount, 0)} people between them</span>
        </div>
        <div className="es-section-scroll">
          {companies.map((c) => (
            <div className="pl-co" key={c.id}>
              <button
                type="button"
                className="pl-co-head"
                aria-expanded={openId === c.id}
                onClick={() => setOpenId(openId === c.id ? null : c.id)}
              >
                <span className="pl-co-body">
                  <span className="pl-row-t">{c.name}</span>
                  {/* `size` is how big they are; `peopleCount` is how many of
                      them you actually know — two different facts, and the
                      second is the one this book is about */}
                  <span className="pl-row-m">
                    {[
                      `${c.peopleCount} ${c.peopleCount === 1 ? 'contact' : 'contacts'}`,
                      c.size ? `${c.size} there` : null,
                      c.industry,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </span>
                <span className="pl-co-n">{c.value ? money(c.value) : <span className="pl-co-nil">—</span>}</span>
              </button>
              {c.note ? <p className="pl-co-note">{c.note}</p> : null}
              {openId === c.id ? <CompanyPeople companyId={c.id} /> : null}
            </div>
          ))}
          {!res.loading && !companies.length ? (
            <p className="es-empty">
              No companies yet. They appear as people arrive with one on them — you don’t have to
              make them up.
            </p>
          ) : null}
        </div>
      </section>
    </>
  );
}

function CompanyPeople({ companyId }: { companyId: string }) {
  const res = useResource<Person[]>(paths.companyPeople(companyId));
  const { openPerson } = usePersonSheet();
  if (res.loading) return <p className="es-empty">reading who’s there…</p>;
  const people = res.data ?? [];
  if (!people.length) return <p className="es-empty">Nobody is attached to this one yet.</p>;
  return (
    <div className="pl-co-people">
      {people.map((p) => (
        <button type="button" className="pl-roster-row" key={p.id} onClick={() => openPerson(p.id)}>
          <span className="pl-roster-n">{p.name}</span>
          <span className="pl-roster-m">{p.note || p.email || p.warmth}</span>
        </button>
      ))}
    </div>
  );
}
