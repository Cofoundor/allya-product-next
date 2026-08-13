'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import { paths, type PeopleFilter } from '@/lib/api/resources';
import { useResource } from '@/lib/api/useResource';
import { GROUPS, branchTints } from '@/lib/brain';
import { Composer } from '@/components/workspace/Composer';
import { BrandCrumbs } from '@/components/workspace/Crumbs';
import { AccountPill } from '@/components/surface/AccountPill';
import { KnowBox, KpiBoxes } from '@/components/email/ChannelBoxes';
import { usePersonSheet } from '@/lib/crm/personSheet';
import type { CrmPage, OriginStat, PersonList, Pipeline } from '@/lib/api/types';
import { PipelineCanvas } from './PipelineCanvas';
import { PeoplePane } from './PeoplePane';
import { CompaniesPane } from './CompaniesPane';
import { PeopleTable } from './PeopleTable';
import { ViewSwitch } from './ViewSwitch';
import { OriginBar } from './OriginBar';
import { StartHere } from './StartHere';
import { PersonSheet } from './PersonSheet';
import { SourcesBox } from './SourcesBox';
import { ImportSheet } from './ImportSheet';

/* ============================================================
   The people layer, opened all the way up.

   Deliberately the same shape as a channel studio: map on the left,
   collection on the right, a sheet over the top. A founder who has used
   /marketing/email already knows how to use this, and the shell it
   borrows is the one that's already proven.

   What it opens on isn't a table. Allya reads position before it reads
   words everywhere else, and a book of people is no different — the funnel
   is the map, and the list is what the map narrows to. The table is the
   other lens, a click away: some questions have a column in them, and
   position can't answer those.
   ============================================================ */

export default function CrmStudio({
  view = 'lifecycle',
  lens = 'table',
}: {
  view?: string;
  /** the grid, the map, or the accounts they belong to */
  lens?: 'people' | 'companies' | 'table';
}) {
  const pageRes = useResource<CrmPage>(paths.crm());
  const { openPerson } = usePersonSheet();

  const originsRes = useResource<OriginStat[]>(paths.origins());
  const [mode, setMode] = useState<'people' | 'companies' | 'table'>(lens);
  const [source, setSource] = useState<string | null>(null);
  const [pipelineId, setPipelineId] = useState(view);
  const [stage, setStage] = useState<string | null>(null);
  const [segment, setSegment] = useState<string | null>(null);
  const [q, setQ] = useState('');
  // the grid opens on a table's worth, not a pane's — sorting fifty rows
  // and calling it "everyone" is the kind of lie a CRM can't afford
  const [limit, setLimit] = useState(lens === 'table' ? 200 : 60);
  const inputRef = useRef<HTMLInputElement>(null);

  const filter = useMemo<PeopleFilter>(
    () => ({
      pipeline: stage || segment || q ? undefined : pipelineId,
      stage: stage ?? undefined,
      segment: segment ?? undefined,
      source: source ?? undefined,
      q: q || undefined,
      limit,
    }),
    [pipelineId, stage, segment, source, q, limit],
  );
  const listRes = useResource<PersonList>(paths.people(filter));

  const page = pageRes.data;
  // narrowing to one door re-reads the funnels through it; with no source
  // picked the page's own copy is already right
  const slicedRes = useResource<Pipeline[]>(source ? paths.pipelines(source) : null);
  const pipelines = useMemo(
    () => (source ? (slicedRes.data ?? []) : (page?.pipelines ?? [])),
    [source, slicedRes.data, page],
  );
  const pipeline = pipelines.find((p) => p.id === pipelineId) ?? pipelines[0] ?? null;
  const accent = useMemo(() => branchTints(GROUPS.sales)[page?.ui.tint ?? 'b1'] ?? GROUPS.sales, [page]);
  const origins = useMemo(() => originsRes.data ?? [], [originsRes.data]);

  const [importing, setImporting] = useState(false);
  const [adding, setAdding] = useState(false);

  /** one narrowing at a time: picking a band clears the segment and the
      search, because three filters at once is a query builder, not a page */
  const pickStage = useCallback((s: string | null) => {
    setStage(s);
    setSegment(null);
    setQ('');
    setLimit(60);
  }, []);

  const pickSegment = useCallback((s: string | null) => {
    setSegment(s);
    setStage(null);
    setQ('');
    setLimit(60);
  }, []);

  const search = useCallback((text: string) => {
    setQ(text.trim());
    setStage(null);
    setSegment(null);
    setLimit(60);
  }, []);

  const pickPipeline = useCallback((id: string) => {
    setPipelineId(id);
    setStage(null);
    setSegment(null);
    setQ('');
    setLimit(60);
  }, []);

  const retry = useCallback(() => {
    pageRes.reload();
    listRes.reload();
  }, [pageRes, listRes]);

  /** the grid sorts what's loaded, so opening it loads enough to be worth
      sorting — sixty is a pane's worth, not a table's */
  const showTable = useCallback(() => {
    setMode('table');
    setLimit((n) => Math.max(n, 200));
  }, []);

  const down = pageRes.error;
  const list = listRes.data;
  const warm = page?.stats.find((s) => s.id === 'warm')?.value ?? '—';

  return (
    <div className="app is-service" style={{ ['--accent' as string]: accent }}>
      <header className="topbar">
        <BrandCrumbs trail={[{ label: 'Company', href: '/' }, { label: 'People' }]} />
        <div className="spacer" />
        <div className="status-line">
          <span className={`pulse${down ? ' off' : ''}`} />
          <span>
            {down
              ? 'Server unreachable'
              : pageRes.loading
                ? 'reading the book…'
                : `${warm} touched this week`}
          </span>
        </div>
        {/* which lens, in the chrome — the same control wherever you are,
            rather than each view drawing its own way back out */}
        <ViewSwitch
          views={page?.ui.views ?? []}
          view={mode}
          onPick={(v) => (v === 'table' ? showTable() : setMode(v))}
        />
        <AccountPill />
      </header>

      <main className={`workspace${mode === 'table' ? ' is-table' : ''}`}>
        {mode === 'table' ? (
          <div className="pl-desk">
            {/* the decision comes before the data: a founder meets three
                things worth doing, then the book underneath them */}
            <StartHere onChanged={retry} />
            <PeopleTable
              people={list?.people ?? []}
              total={list?.total ?? 0}
              caption={list?.caption ?? ''}
              pipelines={pipelines}
              loading={listRes.loading}
              onOpen={openPerson}
              onMore={() => setLimit((n) => n + 200)}
              onSearch={search}
              onChanged={retry}
              onAdd={() => setAdding(true)}
              onImport={() => setImporting(true)}
              query={q}
              hasMore={!!list?.cursor}
            />
          </div>
        ) : (
        <>
        <section className="pane-chat" aria-label="The people layer">
          <div className="canvas">
            <div className="canvas-inner svc-inner">
              <p className={`canvas-greet${page ? '' : ' sk-text'}`}>{page?.blurb ?? ' '}</p>

              {down ? (
                <div className="c-sec brain-box brain-tall brain-down">
                  <p className="brain-down-copy">
                    {down.offline ? 'The book is offline — I can’t reach the server.' : down.message}
                    <button type="button" className="link-btn" onClick={retry}>
                      Try again
                    </button>
                  </p>
                </div>
              ) : (
                <>
                  {/* the same object five times: which one you're looking at
                      is a view, not a different page */}
                  <div className="pl-tabs" role="tablist" aria-label="Pipelines">
                    {pipelines.map((p) => (
                      <button
                        type="button"
                        role="tab"
                        key={p.id}
                        aria-selected={p.id === pipeline?.id}
                        className={`pl-tab${p.id === pipeline?.id ? ' is-on' : ''}`}
                        onClick={() => pickPipeline(p.id)}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>

                  <PipelineCanvas
                    pipeline={pipeline}
                    picked={stage}
                    onPick={pickStage}
                    loading={pageRes.loading || slicedRes.loading}
                    through={source ? origins.find((o) => o.id === source)?.said : undefined}
                  />

                  {/* the distinction that was missing: not "the site", but
                      which post, which story, whose referral */}
                  <OriginBar
                    origins={origins}
                    picked={source}
                    onPick={(s) => {
                      setSource(s);
                      setStage(null);
                      setLimit(60);
                    }}
                  />
                </>
              )}

              <KpiBoxes stats={page?.stats ?? []} />

              {page ? (
                <div className="es-pair">
                  <KnowBox title={page.ui.knowTitle} notes={page.notes} />
                  <SourcesBox sources={page.sources} progress={page.progress} />
                </div>
              ) : null}

              <p className="canvas-hint">Touch a band above, or search below</p>
            </div>
          </div>

          {/* no scripted conversation here on purpose: this page's question
              is "who?", and the honest answer to that is the book itself */}
          <Composer
            inputRef={inputRef}
            onSend={search}
            onEngage={() => {}}
            onDisengage={() => inputRef.current?.blur()}
            suggestions={page?.ui.suggestions ?? []}
            placeholder={page?.ui.placeholder ?? 'Ask about anyone…'}
          />
        </section>

        <aside className="pane-work es-pane" aria-label={mode === 'companies' ? 'Companies' : 'People'}>
          {mode === 'companies' ? (
            <CompaniesPane onBack={() => setMode('table')} />
          ) : (
          <PeoplePane
            people={list?.people ?? []}
            total={list?.total ?? 0}
            caption={list?.caption ?? ''}
            segments={page?.segments ?? []}
            activeSegment={segment}
            loading={listRes.loading}
            error={!!listRes.error}
            onOpen={openPerson}
            onSegment={pickSegment}
            onAdd={() => setAdding(true)}
            onImport={() => setImporting(true)}
            onRetry={retry}
            onMore={() => setLimit((n) => n + 60)}
            hasMore={!!list?.cursor}
          />
          )}
        </aside>
        </>
        )}
      </main>

      <PersonSheet pipelines={pipelines} onChanged={retry} />
      {importing || adding ? (
        <ImportSheet
          key={adding ? 'one' : 'file'}
          mode={adding ? 'one' : 'file'}
          onClose={() => {
            setImporting(false);
            setAdding(false);
          }}
          onDone={retry}
        />
      ) : null}
    </div>
  );
}
