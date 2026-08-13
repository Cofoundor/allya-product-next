'use client';

import { useCallback, useEffect, useState } from 'react';
import { addPerson, importPeople, previewImport } from '@/lib/api/resources';
import type { ImportPreview, ImportResult } from '@/lib/api/types';

/* ============================================================
   Getting people in.

   Two doors, one sheet, because they're the same intent at different
   sizes: a name that arrived in a DM, and the spreadsheet a founder has
   been keeping since before any of this existed.

   The file door shows the guess before it commits to it — which columns
   it thinks are which, how many rows are new, and exactly who it would
   merge onto whom. A founder who can see the merge is a founder who
   trusts it; the alternative is 41 stale leads nobody meant to make.
   ============================================================ */

/** Mounted only while it's open, and keyed by mode — so every opening
    starts empty without an effect having to clear six fields. */
export function ImportSheet({
  mode,
  onClose,
  onDone,
}: {
  mode: 'one' | 'file';
  onClose: () => void;
  onDone: () => void;
}) {
  const [csv, setCsv] = useState('');
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [note, setNote] = useState('');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const look = useCallback(async (text: string) => {
    setCsv(text);
    setPreview(null);
    setErr(null);
    if (!text.trim()) return;
    setBusy(true);
    try {
      setPreview(await previewImport(text));
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Couldn’t read that file.');
    } finally {
      setBusy(false);
    }
  }, []);

  const onFile = useCallback(
    (file: File | undefined) => {
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => look(String(reader.result ?? ''));
      reader.readAsText(file);
    },
    [look],
  );

  const commit = useCallback(async () => {
    setBusy(true);
    setErr(null);
    try {
      setResult(await importPeople({ csv, segmentLabel: 'The file you uploaded' }));
      onDone();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Couldn’t bring them in.');
    } finally {
      setBusy(false);
    }
  }, [csv, onDone]);

  const addOne = useCallback(async () => {
    if (!name.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      await addPerson({ name: name.trim(), email: email.trim() || undefined, note: note.trim() });
      onDone();
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Couldn’t add them.');
    } finally {
      setBusy(false);
    }
  }, [name, email, note, onDone, onClose]);

  return (
    <div className="dot-layer is-open pl-sheet-layer">
      <div className="dot-wash" onClick={onClose} />
      <section className="dot-sheet pl-import" role="dialog" aria-modal="true" aria-label="Add people">
        <div className="dot-scroll">
          <div className="dot-head">
            <button type="button" className="dot-back" onClick={onClose}>
              ← Close
            </button>
            <span className="dot-crumb">{mode === 'one' ? 'one person' : 'a file'}</span>
          </div>

          {mode === 'one' ? (
            <>
              <h1 className="dot-title">Add someone</h1>
              <p className="dot-blurb">
                A name that arrived in a DM belongs on the same book as everyone else.
              </p>
              <div className="pl-form">
                <label className="pl-field">
                  <span>Name</span>
                  <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Who are they?" />
                </label>
                <label className="pl-field">
                  <span>Email</span>
                  <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="so they can be matched later" />
                </label>
                <label className="pl-field">
                  <span>What you know</span>
                  <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="where they came from, what they want" />
                </label>
              </div>
              {err ? <p className="pl-err">{err}</p> : null}
              <button type="button" className="cta" disabled={busy || !name.trim()} onClick={addOne}>
                {busy ? 'Adding…' : 'Add them'}
              </button>
            </>
          ) : result ? (
            <>
              <h1 className="dot-title">Brought in</h1>
              <ul className="es-know-list">
                {result.learned.map((l) => (
                  <li key={l}>
                    <span className="es-know-dot" />
                    {l}
                  </li>
                ))}
              </ul>
              <button type="button" className="cta" onClick={onClose}>
                Done
              </button>
            </>
          ) : (
            <>
              <h1 className="dot-title">Upload the list you already keep</h1>
              <p className="dot-blurb">
                Duplicates get merged onto the record that’s already here, never doubled. You see
                exactly who, before anything moves.
              </p>

              <label className="pl-drop">
                <input
                  type="file"
                  accept=".csv,text/csv,text/plain"
                  onChange={(e) => onFile(e.target.files?.[0])}
                />
                <span>Choose a CSV</span>
              </label>

              <textarea
                className="pl-paste"
                value={csv}
                placeholder="…or paste the rows here, heading row first"
                onChange={(e) => look(e.target.value)}
              />

              {busy && !preview ? <p className="es-empty">Reading it…</p> : null}
              {err ? <p className="pl-err">{err}</p> : null}

              {preview ? (
                <>
                  <div className="dot-sec">What it thinks the columns are</div>
                  <div className="pl-map-cols">
                    {preview.columns.map((c) => (
                      <span className="pl-col" key={c}>
                        <span className="k">{c}</span>
                        <span className="v">{preview.mapping[c] ?? 'ignored'}</span>
                      </span>
                    ))}
                  </div>

                  <div className="dot-sec">What it would do</div>
                  <div className="pl-facts">
                    <span className="pl-fact">
                      <span className="k">Rows</span>
                      <span className="v">{preview.rowsTotal}</span>
                    </span>
                    <span className="pl-fact">
                      <span className="k">New people</span>
                      <span className="v">{preview.rowsReady}</span>
                    </span>
                    <span className="pl-fact">
                      <span className="k">Already here</span>
                      <span className="v">{preview.duplicates.length}</span>
                    </span>
                  </div>

                  {preview.problems.map((p) => (
                    <p className="pl-err" key={p}>
                      {p}
                    </p>
                  ))}

                  {preview.duplicates.length ? (
                    <>
                      <div className="dot-sec">Who it would merge</div>
                      <div className="pl-dupes">
                        {preview.duplicates.map((d) => (
                          <div className="pl-dupe" key={`${d.row}-${d.existingId}`}>
                            <span className="pl-dupe-r">row {d.row}</span>
                            <span className="pl-dupe-t">
                              {d.incoming} → <b>{d.existing}</b>
                            </span>
                            <span className="pl-dupe-m">matched on {d.matchedOn}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : null}

                  <button
                    type="button"
                    className="cta"
                    disabled={busy || (!preview.rowsReady && !preview.duplicates.length)}
                    onClick={commit}
                  >
                    {busy ? 'Bringing them in…' : `Bring in ${preview.rowsReady} and merge ${preview.duplicates.length}`}
                  </button>
                </>
              ) : null}
            </>
          )}
        </div>
      </section>
    </div>
  );
}
