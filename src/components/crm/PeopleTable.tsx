'use client';

import { memo, useCallback, useMemo, useState } from 'react';
import { addFollowup, createSegment, paths, takeMove } from '@/lib/api/resources';
import { useResource } from '@/lib/api/useResource';
import type {
  Company,
  PersonRow,
  Pipeline,
  TableColumn,
  TableSpec,
  TouchBy,
  Warmth,
} from '@/lib/api/types';
import { useLexicon } from '@/lib/crm/lexicon';
import { RowDetail } from './RowDetail';

/* ============================================================
   The book as a grid — and the front door.

   The funnel answers "where is everyone". It cannot answer "who signed up
   in March, has no address, and nobody has spoken to since" — and that is
   most of what a founder actually asks a CRM. Position is a summary;
   columns are the record. So this opens first and the map is a click away.

   Everything the CRM knows has a column here. No screen fits twenty-two of
   them, so the picker decides which show, the row expands for the rest,
   and selecting rows lets you act on many at once. Sorting, the file it
   writes, and the selection all work over what's on screen — the header
   says how many that is rather than implying it sorted all hundred.
   ============================================================ */

/* The warmth words and their order used to sit here as two constants. They're
   vocabulary for an enum the API owns, so they come from GET /crm/lexicon
   now — which also ended the three different spellings of "never" this app
   had on three different screens. */

const money = (n: number) => `₹${n.toLocaleString('en-IN')}`;

const said = (n: number) =>
  n < 1 ? 'today' : n < 2 ? 'yesterday' : n < 14 ? `${Math.floor(n)}d` : n < 60 ? `${Math.floor(n / 7)}w` : `${Math.floor(n / 30)}mo`;

function daysSince(at: number | null) {
  if (!at) return null;
  return Math.max(0, (Date.now() - at * 1000) / 86400_000);
}

/** a due date said short — a column has a word's room, not a line's */
function saidDue(due: string | null, overdue: boolean) {
  if (!due) return overdue ? 'late' : '';
  const d = new Date(`${due}T00:00:00`);
  const now = new Date();
  const days = Math.round(
    (d.getTime() - new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) / 86400_000,
  );
  if (days < 0) return `${-days}d late`;
  if (days === 0) return 'today';
  if (days === 1) return 'tomorrow';
  if (days < 7) return `in ${days}d`;
  return due;
}

/* The keys this file knows how to *draw*. Which columns exist, what they're
   called and which are on by default all come from GET /crm/table — this
   union only says "I have bespoke rendering for these". A column the backend
   adds that isn't here still appears: it falls through to the plain-text cell
   below, reading the field its key names off the row. */
type Key =
  | 'name' | 'kind' | 'company' | 'stage' | 'warmth' | 'touch' | 'due' | 'origin'
  | 'owner' | 'value' | 'open' | 'deals' | 'created' | 'email' | 'phone' | 'handle'
  | 'tags' | 'segments' | 'touches' | 'last' | 'inStage' | 'note'
  | 'intent' | 'companySize' | 'companyIndustry';

/* A column as this file uses it: the contract's definition plus the one thing
   the contract deliberately withholds — how wide it sits on a screen. */
interface Col extends TableColumn {
  key: string;
  w: number;
}

/* How wide, in pixels, declared rather than discovered. A table left to size
   its own columns has to measure every cell in every row before it can lay
   out the first one; with a dozen columns of prose that costs milliseconds
   per layout, and a layout runs on every hover, sort and keystroke.
   Presentation, so it lives here rather than in the API — and a key with no
   entry gets DEFAULT_W, which is what lets a new backend column render
   without touching this file. */
const WIDTHS: Record<string, number> = {
  name: 210, kind: 110, company: 150, companySize: 115, companyIndustry: 130,
  owner: 105, intent: 250, stage: 135, inStage: 90, warmth: 115, touch: 75,
  due: 175, segments: 230, open: 105, value: 95, deals: 75, email: 205,
  phone: 130, handle: 130, tags: 175, origin: 210, created: 105, touches: 95,
  last: 250, note: 300,
};
const DEFAULT_W = 150;

const today = () => new Date().toISOString().slice(0, 10);

export function PeopleTable({
  people,
  total,
  caption,
  pipelines,
  loading,
  onOpen,
  onMore,
  onSearch,
  onChanged,
  onAdd,
  onImport,
  query,
  hasMore,
}: {
  people: PersonRow[];
  total: number;
  caption: string;
  pipelines: Pipeline[];
  loading: boolean;
  onOpen: (id: string) => void;
  onMore: () => void;
  onSearch: (text: string) => void;
  onChanged: () => void;
  onAdd: () => void;
  onImport: () => void;
  query: string;
  hasMore: boolean;
}) {
  const companiesRes = useResource<Company[]>(paths.companies());
  /* which columns exist, what they're called, and the named sets to pick
     between — all of it the backend's, none of it this file's */
  const specRes = useResource<TableSpec>(paths.crmTable());
  const lex = useLexicon();
  const [sort, setSort] = useState<string | null>(null);
  const [desc, setDesc] = useState(false);
  const [text, setText] = useState(query);
  /* null until you touch the picker: the default set is the contract's to
     decide, and it hasn't arrived on the first render */
  const [shown, setShown] = useState<Set<string> | null>(null);
  const [preset, setPreset] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [openRow, setOpenRow] = useState<string | null>(null);
  const [picked, setPicked] = useState<Set<string>>(() => new Set());
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [per, setPer] = useState(50);

  const co = useMemo(() => {
    const map: Record<string, string> = {};
    for (const c of companiesRes.data ?? []) map[c.id] = c.name;
    return map;
  }, [companiesRes.data]);

  /** a stage is only a label and an order once you know its pipeline. The
      note is the backend's plain-English gloss ("They made an account.
      That's all it means.") — a founder shouldn't have to infer a funnel */
  const stages = useMemo(() => {
    const map: Record<string, { label: string; at: number; pipeline: string; note: string }> = {};
    for (const pl of pipelines) {
      for (const s of pl.stages) {
        map[s.id] = { label: s.label, at: s.at, pipeline: pl.label, note: s.note };
      }
    }
    return map;
  }, [pipelines]);

  /* the contract's columns, plus the widths this screen puts on them */
  const all = useMemo<Col[]>(
    () => (specRes.data?.columns ?? []).map((c) => ({ ...c, w: WIDTHS[c.key] ?? DEFAULT_W })),
    [specRes.data],
  );
  const presets = useMemo(() => specRes.data?.presets ?? [], [specRes.data]);
  const groups = useMemo(() => specRes.data?.groups ?? [], [specRes.data]);

  /* derived rather than seeded by an effect, so there's never a frame showing
     a guess: before you touch the picker, the shown set *is* the default the
     backend declared */
  const shownKeys = useMemo(
    () => shown ?? new Set(all.filter((c) => c.on).map((c) => c.key)),
    [shown, all],
  );
  const activePreset = preset ?? presets[0]?.id ?? null;

  const cols = useMemo(() => all.filter((c) => shownKeys.has(c.key)), [all, shownKeys]);

  /** the plain-text value: what sorting compares and the file writes */
  const cell = useCallback(
    (p: PersonRow, key: string): string => {
      const days = daysSince(p.lastTouchAt);
      switch (key) {
        case 'name': return p.name;
        case 'kind': return (p.kinds ?? []).join(', ');
        case 'company': return p.companyName || (p.companyId ? (co[p.companyId] ?? '') : '');
        case 'companySize': return p.companySize;
        case 'companyIndustry': return p.companyIndustry;
        // the file gets the read and the reason, since a column of guesses
        // with the evidence stripped off is worse than no column
        case 'intent': return p.intentWhy ? `${p.intent} — ${p.intentWhy}` : p.intent;
        case 'stage': return stages[p.stageId]?.label ?? p.stageId;
        case 'inStage': return p.daysInStage == null ? '' : `${p.daysInStage}d`;
        case 'warmth': return lex.warmthSaid(p.warmth);
        case 'touch': return days === null ? '' : said(days);
        case 'due': return p.nextStep ?? '';
        case 'segments': return (p.segmentLabels ?? []).join(' · ');
        case 'open': return p.openValue ? money(p.openValue) : '';
        case 'value': return p.value ? money(p.value) : '';
        case 'deals': return p.dealCount ? String(p.dealCount) : '';
        case 'email': return p.email ?? '';
        case 'phone': return p.phone ?? '';
        case 'handle': return p.handle ?? '';
        case 'tags': return (p.tags ?? []).join(' ');
        case 'origin': return p.originSaid;
        case 'owner': return p.owner === 'you' ? 'you' : p.owner;
        case 'created': return p.created;
        case 'touches': return String(p.touchCount ?? 0);
        case 'last': return p.lastSaid;
        case 'note': return p.note;
        // a column the backend added that this file has no case for: read the
        // field its key names off the row, so it still shows something true
        default: {
          const v = (p as unknown as Record<string, unknown>)[key];
          return v == null ? '' : Array.isArray(v) ? v.join(' ') : String(v);
        }
      }
    },
    [co, stages, lex],
  );

  /** what the column sorts on, which is rarely the string it shows */
  const by = useCallback(
    (p: PersonRow, key: string): string | number => {
      switch (key) {
        case 'warmth': return lex.warmthRank(p.warmth);
        case 'touch': return daysSince(p.lastTouchAt) ?? 1e6;
        case 'inStage': return p.daysInStage ?? -1;
        case 'stage': return `${stages[p.stageId]?.pipeline ?? ''}${stages[p.stageId]?.at ?? 9}`;
        // group the same read together, rather than by the reason under it
        case 'intent': return p.intent.toLowerCase();
        // no date sorts last, not first: an empty cell isn't the most urgent
        case 'due': return p.nextDue ?? '9999';
        case 'open': return p.openValue;
        case 'value': return p.value ?? -1;
        case 'deals': return p.dealCount;
        case 'touches': return p.touchCount;
        default: return cell(p, key).toLowerCase();
      }
    },
    [cell, stages, lex],
  );

  const rows = useMemo(() => {
    if (!sort) return people; // the server's order: what's owed, then warm
    const out = [...people].sort((a, b) => {
      const x = by(a, sort);
      const y = by(b, sort);
      if (x === y) return a.name.localeCompare(b.name);
      return x < y ? -1 : 1;
    });
    return desc ? out.reverse() : out;
  }, [people, sort, desc, by]);

  /* Only a page of it reaches the DOM. Twenty-two columns across two
     hundred rows is four thousand cells, and a browser asked to lay that
     out on every sort or column toggle stops being a browser. Sorting,
     selecting and the file all still work over everything loaded — the
     page is what you're looking at, not what the table knows. */
  const pages = Math.max(1, Math.ceil(rows.length / per));
  const at = Math.min(page, pages - 1);
  const shownRows = useMemo(() => rows.slice(at * per, at * per + per), [rows, at, per]);

  const pick = useCallback(
    (key: string) => {
      if (sort === key) {
        // third click on the same column returns to the page's own order
        if (desc) { setSort(null); setDesc(false); } else setDesc(true);
        return;
      }
      setSort(key);
      setDesc(false);
    },
    [sort, desc],
  );

  const toggleCol = useCallback((key: string) => {
    setPreset('custom'); // touching one column means you've left the preset
    // seeded from what's on screen, because `shown` is null until first touch
    setShown((s) => {
      const next = new Set(s ?? shownKeys);
      // the name is how you tell one row from another — it doesn't leave
      if (key === 'name') return next;
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, [shownKeys]);

  const applyPreset = useCallback((id: string) => {
    const p = presets.find((x) => x.id === id);
    if (!p) return;
    setPreset(id);
    setShown(new Set(p.keys));
  }, [presets]);

  const toggleOpen = useCallback((id: string) => {
    setOpenRow((o) => (o === id ? null : id));
  }, []);

  const toggleRow = useCallback((id: string) => {
    setPicked((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // the header box picks the page you're looking at; the selection itself
  // survives paging, so you can gather people across several
  const allPicked = shownRows.length > 0 && shownRows.every((p) => picked.has(p.id));
  const chosen = useMemo(() => rows.filter((p) => picked.has(p.id)), [rows, picked]);

  /** the file, written from what's on screen — the shown columns, in the
      shown order, over the selection if there is one */
  const download = useCallback(() => {
    const src = chosen.length ? chosen : rows;
    const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
    const lines = [cols.map((c) => esc(c.label)).join(',')];
    for (const p of src) lines.push(cols.map((c) => esc(cell(p, c.key))).join(','));
    const url = URL.createObjectURL(
      new Blob([`﻿${lines.join('\n')}`], { type: 'text/csv;charset=utf-8' }),
    );
    const a = document.createElement('a');
    a.href = url;
    a.download = `people-${today()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [chosen, rows, cols, cell]);

  /* ---- acting on many at once ---- */

  const owe = useCallback(async () => {
    const what = window.prompt(`What do you owe these ${chosen.length}?`, 'Write to them');
    if (!what) return;
    setBusy(true);
    try {
      for (const p of chosen) await addFollowup(p.id, what);
      setToast(`${chosen.length} on your list.`);
      setPicked(new Set());
      onChanged();
    } finally {
      setBusy(false);
    }
  }, [chosen, onChanged]);

  /** the selection becomes a segment in one call: a segment can be a
      hand-picked list as well as a rule, and this is the list kind — it
      stays exactly who you chose rather than re-running as people move */
  const group = useCallback(async () => {
    const label = window.prompt(`Call this group of ${chosen.length} what?`, 'My list');
    if (!label) return;
    setBusy(true);
    try {
      await createSegment(
        label,
        { personIds: chosen.map((p) => p.id) },
        `${chosen.length} you picked by hand`,
      );
      setToast(`“${label}” is a segment now — marketing can write to it.`);
      setPicked(new Set());
      onChanged();
    } finally {
      setBusy(false);
    }
  }, [chosen, onChanged]);

  const take = useCallback(
    async (moveId: string, personId: string, by: TouchBy) => {
      setBusy(true);
      try {
        const r = await takeMove(personId, moveId, by);
        setToast(r.toast);
        onChanged();
      } catch (e) {
        setToast(e instanceof Error ? e.message : 'That didn’t take.');
      } finally {
        setBusy(false);
      }
    },
    [onChanged],
  );

  const span = cols.length + 2;

  return (
    <section className="pl-tbl-wrap" aria-label="Everyone, as a table">
      <div className="pl-tbl-head">
        <div className="pl-tbl-title">
          <h2>Everyone</h2>
          <span>
            {loading ? 'reading the book…' : caption}
            {people.length < total ? ` · ${people.length} on screen` : null}
            {sort ? ` · by ${all.find((c) => c.key === sort)?.label.toLowerCase()}` : null}
          </span>
        </div>

        <form
          className="pl-tbl-find"
          onSubmit={(e) => {
            e.preventDefault();
            onSearch(text);
          }}
        >
          <input
            type="search"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Find anyone — name, address, or what Allya wrote"
            aria-label="Search everyone"
          />
        </form>

        <div className="pl-tbl-acts">
          <span className="pl-colpick">
            <button type="button" className="pl-ghost" onClick={() => setPicking((v) => !v)} aria-expanded={picking}>
              {presets.find((p) => p.id === activePreset)?.label ?? 'Your columns'} <b>{cols.length}</b>
            </button>
            {picking ? (
              <span className="pl-colmenu">
                <span className="pl-presets">
                  {presets.map((p) => (
                    <button
                      type="button"
                      key={p.id}
                      className={`pl-preset${preset === p.id ? ' is-on' : ''}`}
                      onClick={() => applyPreset(p.id)}
                    >
                      <b>{p.label}</b>
                      <span>{p.note}</span>
                    </button>
                  ))}
                </span>
                {groups.map((g) => (
                  <span className="pl-colgrp" key={g}>
                    <span className="pl-colgrp-t">{g}</span>
                    {all.filter((c) => c.group === g).map((c) => (
                      <label key={c.key} className={c.key === 'name' ? 'is-fixed' : undefined}>
                        <input
                          type="checkbox"
                          checked={shownKeys.has(c.key)}
                          disabled={c.key === 'name'}
                          onChange={() => toggleCol(c.key)}
                        />
                        {c.label}
                      </label>
                    ))}
                  </span>
                ))}
              </span>
            ) : null}
          </span>
          {/* the way out of this view lives in the header now, beside the
              status line — one control for every lens, not one per pane */}
          <button type="button" className="pl-ghost" onClick={download} disabled={!rows.length}>
            {chosen.length ? `Export ${chosen.length}` : 'Export CSV'}
          </button>
        </div>
      </div>

      {/* what makes a grid a CRM rather than a report: you can act on many */}
      {chosen.length ? (
        <div className="pl-bulk">
          <span className="pl-bulk-n">{chosen.length} picked</span>
          <button type="button" onClick={owe} disabled={busy}>
            Owe them something
          </button>
          <button type="button" onClick={group} disabled={busy}>
            Make a segment
          </button>
          <button type="button" onClick={download} disabled={busy}>
            Export just these
          </button>
          <button type="button" className="pl-bulk-x" onClick={() => setPicked(new Set())}>
            Clear
          </button>
        </div>
      ) : null}

      {toast ? <p className="pl-tbl-toast">{toast}</p> : null}

      {/* the grid can't be drawn before the contract says what its columns
          are. Saying so is better than drawing a table of guesses and then
          rearranging it under someone's cursor. */}
      {specRes.error ? (
        <div className="pl-tbl-scroll">
          <p className="pl-tbl-empty">
            {specRes.error.offline
              ? 'The book is offline — I can’t reach the server.'
              : specRes.error.message}
            <button type="button" className="link-btn" onClick={specRes.reload}>
              Try again
            </button>
          </p>
        </div>
      ) : !all.length ? (
        <div className="pl-tbl-scroll">
          <p className="pl-tbl-empty">Reading the book…</p>
        </div>
      ) : (
      <div className="pl-tbl-scroll">
        <table className="pl-tbl">
          {/* every width declared up front, so `table-layout: fixed` can
              lay the grid out without measuring a single cell */}
          <colgroup>
            <col style={{ width: 34 }} />
            <col style={{ width: 30 }} />
            {cols.map((c) => (
              <col key={c.key} style={{ width: c.w }} />
            ))}
          </colgroup>

          <thead>
            <tr>
              <th scope="col" className="pl-tbl-pickcol">
                <input
                  type="checkbox"
                  checked={allPicked}
                  aria-label="Pick everyone on this page"
                  onChange={() =>
                    setPicked((s) => {
                      const next = new Set(s);
                      for (const p of shownRows) {
                        if (allPicked) next.delete(p.id);
                        else next.add(p.id);
                      }
                      return next;
                    })
                  }
                />
              </th>
              <th scope="col" className="pl-tbl-expcol" aria-label="Expand" />
              {cols.map((c) => (
                <th
                  key={c.key}
                  scope="col"
                  className={`${c.num ? 'is-num' : ''}${c.wide ? ' is-wide' : ''}`}
                  aria-sort={sort === c.key ? (desc ? 'descending' : 'ascending') : 'none'}
                >
                  <button type="button" onClick={() => pick(c.key)}>
                    {c.label}
                    <span className="pl-tbl-caret" aria-hidden>
                      {sort === c.key ? (desc ? '↓' : '↑') : ''}
                    </span>
                  </button>
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {shownRows.map((p) => (
              <Row
                key={p.id}
                p={p}
                cols={cols}
                span={span}
                busy={busy}
                open={openRow === p.id}
                picked={picked.has(p.id)}
                stages={stages}
                warmthSaid={lex.warmthSaid}
                co={co}
                /* the handlers take an id rather than closing over one, so
                   they're the same functions on every render and `memo` can
                   actually hold. Inline arrows here meant every keystroke in
                   the search box re-rendered all fifty rows. */
                onToggleRow={toggleOpen}
                onPick={toggleRow}
                onOpen={onOpen}
                onTake={take}
              />
            ))}
          </tbody>
        </table>

        {!rows.length && !loading && query ? (
          <p className="pl-tbl-empty">
            Nobody matches “{query}”. Clear the search to see everyone.
          </p>
        ) : null}

        {/* Day one: the book is empty, and that's the state this thing will
            be in the first time anybody ever opens it. Three doors, each
            saying what happens after you walk through it. */}
        {!rows.length && !loading && !query ? (
          <div className="pl-first">
            <h3>Nobody in here yet</h3>
            <p className="pl-first-lede">
              This fills up on its own once people start arriving. Until then, the fastest way in is
              the list you already keep somewhere.
            </p>
            <div className="pl-doors">
              <button type="button" className="pl-door" onClick={onImport}>
                <b>Upload the list you keep</b>
                <span>
                  A CSV from your inbox, a spreadsheet, an old export. Duplicates get merged onto one
                  record instead of doubling — you see exactly who, before anything moves.
                </span>
              </button>
              <button type="button" className="pl-door" onClick={onAdd}>
                <b>Add one person</b>
                <span>
                  Somebody who just wrote to you. A name and an address is enough — everything that
                  happens to them after lands on the same record.
                </span>
              </button>
              <span className="pl-door is-quiet">
                <b>Let signups come in</b>
                <span>
                  Already on. Anyone who makes an account, pays, or replies to a campaign arrives
                  here without you doing anything.
                </span>
              </span>
            </div>
          </div>
        ) : null}
      </div>
      )}

      {rows.length ? (
        <div className="pl-pager">
          <span className="pl-pager-n">
            {at * per + 1}–{Math.min(rows.length, at * per + per)} of {rows.length}
            {people.length < total ? ` loaded · ${total} in all` : null}
          </span>
          <label className="pl-pager-per">
            Rows
            <select
              value={per}
              onChange={(e) => {
                setPer(Number(e.target.value));
                setPage(0);
              }}
            >
              {[25, 50, 100].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <span className="pl-pager-nav">
            <button type="button" onClick={() => setPage(0)} disabled={at === 0}>
              ⇤
            </button>
            <button type="button" onClick={() => setPage(at - 1)} disabled={at === 0}>
              ←
            </button>
            <span>
              {at + 1} / {pages}
            </span>
            <button type="button" onClick={() => setPage(at + 1)} disabled={at >= pages - 1}>
              →
            </button>
            <button type="button" onClick={() => setPage(pages - 1)} disabled={at >= pages - 1}>
              ⇥
            </button>
          </span>
          {hasMore ? (
            <button type="button" className="pl-ghost" onClick={onMore}>
              Load more from the server
            </button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

/* Memoised, and it has to be: the search box's text lives in the table, so
   without this every keystroke re-rendered fifty rows of a dozen cells each
   — 150ms of blocked main thread per character. Now a row re-renders when
   that row changes. */
const Row = memo(function Row({
  p,
  cols,
  span,
  busy,
  open,
  picked,
  stages,
  co,
  warmthSaid,
  onToggleRow,
  onPick,
  onOpen,
  onTake,
}: {
  p: PersonRow;
  cols: Col[];
  span: number;
  busy: boolean;
  open: boolean;
  picked: boolean;
  stages: Record<string, { label: string; at: number; pipeline: string; note: string }>;
  co: Record<string, string>;
  /* the API's word for a warmth. A function rather than a map so the row
     never has to know the vocabulary hasn't loaded yet. */
  warmthSaid: (w: Warmth) => string;
  onToggleRow: (id: string) => void;
  onPick: (id: string) => void;
  onOpen: (id: string) => void;
  onTake: (moveId: string, id: string, by: TouchBy) => void;
}) {
  const days = daysSince(p.lastTouchAt);

  /** the rendered cell. Most are the plain value; a few carry a second line
      or a tint, because a column that only shows a string throws away what
      the record actually knows. */
  const render = (key: string) => {
    switch (key) {
      case 'name':
        return (
          <td className="pl-tbl-name" key={key}>
            <button type="button" onClick={() => onOpen(p.id)}>
              {p.name}
            </button>
            <span>{p.email ?? p.phone ?? p.handle ?? '—'}</span>
          </td>
        );
      case 'stage':
        return (
          // the pipeline's name under every row was noise — it's the same
          // word ninety times. What it means is the useful half.
          <td key={key} title={stages[p.stageId]?.note || undefined}>
            <span className={`pl-stage-pill s-${p.stageId}`}>
              {stages[p.stageId]?.label ?? p.stageId}
            </span>
          </td>
        );
      case 'warmth':
        return (
          <td key={key}>
            <span className={`pl-tbl-w w-${p.warmth}`}>{warmthSaid(p.warmth)}</span>
          </td>
        );
      case 'due':
        return (
          <td key={key}>
            {p.nextStep ? (
              <>
                <span className={`pl-due${p.overdue ? ' is-late' : ''}`}>
                  {saidDue(p.nextDue, p.overdue)}
                </span>
                <span className="pl-tbl-sub">
                  {p.nextStep}
                  {p.nextBy && p.nextBy !== 'you' ? ` · ${p.nextBy}` : ''}
                </span>
              </>
            ) : (
              <span className="pl-tbl-none">nothing owed</span>
            )}
          </td>
        );
      case 'touch':
        return (
          <td className="is-num" key={key}>
            {days === null ? '—' : said(days)}
          </td>
        );
      case 'inStage':
        return (
          <td className="is-num" key={key}>
            {p.daysInStage == null ? '—' : `${p.daysInStage}d`}
          </td>
        );
      case 'intent':
        return (
          // the read on top, the evidence under it. Allya is allowed to
          // infer; she isn't allowed to do it without showing her working.
          <td className="is-wide" key={key} title={p.intentWhy || undefined}>
            <span className="pl-tbl-intent">{p.intent || '—'}</span>
            {p.intentWhy ? <span className="pl-tbl-sub">{p.intentWhy}</span> : null}
          </td>
        );
      case 'company':
        return <td key={key}>{p.companyName || (p.companyId ? (co[p.companyId] ?? '—') : '—')}</td>;
      case 'companySize':
        return <td key={key}>{p.companySize || '—'}</td>;
      case 'industry':
        return <td key={key}>{p.companyIndustry || '—'}</td>;
      case 'open':
        return (
          <td className="is-num" key={key}>
            {p.openValue ? money(p.openValue) : '—'}
          </td>
        );
      case 'value':
        return (
          <td className="is-num" key={key}>
            {p.value ? money(p.value) : '—'}
          </td>
        );
      case 'deals':
        return (
          <td className="is-num" key={key}>
            {p.dealCount || '—'}
          </td>
        );
      case 'touches':
        return (
          <td className="is-num" key={key}>
            {p.touchCount}
          </td>
        );
      case 'created':
        return (
          <td className="is-num" key={key}>
            {p.created}
          </td>
        );
      case 'tags':
      case 'segments': {
        // never assume a row is complete: a cached payload from before a
        // field existed, or a partial one, must cost an em-dash in one cell
        // rather than the whole page
        const list = (key === 'tags' ? p.tags : p.segmentLabels) ?? [];
        return (
          <td className={key === 'segments' ? 'is-wide' : undefined} key={key}>
            {list.length ? (
              <span className="pl-tbl-chips">
                {list.slice(0, 3).map((x, i) => (
                  <span key={`${x}-${i}`}>{x}</span>
                ))}
                {list.length > 3 ? <span className="pl-tbl-none">+{list.length - 3}</span> : null}
              </span>
            ) : (
              '—'
            )}
          </td>
        );
      }
      case 'origin':
        return (
          <td className="is-wide" key={key}>
            <span className="pl-tbl-stage">{p.originSaid || '—'}</span>
            <span className="pl-tbl-sub">{p.originChannel ?? ''}</span>
          </td>
        );
      case 'last':
        return (
          <td className="is-wide pl-tbl-note" key={key}>
            {p.lastSaid || '—'}
          </td>
        );
      case 'note':
        return (
          <td className="is-wide pl-tbl-note" key={key}>
            {p.note || '—'}
          </td>
        );
      case 'owner':
        return <td key={key}>{p.owner === 'you' ? 'you' : p.owner}</td>;
      case 'kind':
        return <td key={key}>{(p.kinds ?? []).join(', ')}</td>;
      case 'email':
        return <td key={key}>{p.email ?? '—'}</td>;
      case 'phone':
        return <td key={key}>{p.phone ?? '—'}</td>;
      case 'handle':
        return <td key={key}>{p.handle ?? '—'}</td>;
      // no bespoke rendering for this key: show the field it names
      default: {
        const v = (p as unknown as Record<string, unknown>)[key];
        const said = v == null ? '' : Array.isArray(v) ? v.join(' · ') : String(v);
        return <td key={key}>{said || '—'}</td>;
      }
    }
  };

  return (
    <>
      <tr className={`${p.overdue ? 'is-late' : ''}${open ? ' is-open' : ''}`}>
        <td className="pl-tbl-pickcol">
          <input
            type="checkbox"
            checked={picked}
            onChange={() => onPick(p.id)}
            aria-label={`Pick ${p.name}`}
          />
        </td>
        <td className="pl-tbl-expcol">
          <button
            type="button"
            className="pl-tbl-exp"
            aria-expanded={open}
            aria-label={open ? `Collapse ${p.name}` : `Expand ${p.name}`}
            onClick={() => onToggleRow(p.id)}
          >
            {open ? '▾' : '▸'}
          </button>
        </td>
        {cols.map((c) => render(c.key))}
      </tr>
      {open ? (
        <RowDetail
          personId={p.id}
          cols={span}
          busy={busy}
          onOpen={() => onOpen(p.id)}
          onTake={(mid, by) => onTake(mid, p.id, by)}
        />
      ) : null}
    </>
  );
});
