'use client';

import { useValue } from '@legendapp/state/react';
import {
  formatSignedMoney,
  mappingIsComplete,
  planImport,
  previewRows,
  readImportFile,
  TABLE_ORDER,
  TABLES,
  dayLabel,
  type ImportPlan,
  type ImportRow,
  type ImportSession,
  type MappedField,
  type DayKey,
  type PreviewRow,
  type StoreSnapshot,
} from '@repo/core';
import { applyPlan, applyWrites, readStoreSnapshot, storeHasPulled, type ApplyProgress } from '@repo/data';
import { useMemo, useRef, useState, type ReactNode } from 'react';
import { ExportDataButton } from '@/components/account/export-data-button';
import { Select } from '@/components/controls/select';
import { Bubble } from '@/components/ledger/glyph';
import { showToast } from '@/components/shell/shell-store';
import { useShellApi } from '@/components/shell/shell-context';
import { BOARD_FIELDS, columnLetter, dateOrderHint, importCounts, MORE_FIELDS, undoImport, writtenRows, type ImportStep } from '@/lib/import-flow';
import { useLedger, type Ledger } from '@/lib/ledger/use-ledger';
import { moniStore } from '@/lib/moni-store';
import { useScreenKeys } from '@/lib/screen-keys';
import { Mdi, SETTINGS_ICONS } from './mdi';

type Generic = Extract<ImportSession, { kind: 'generic' }>;

/** Where Import data is: no file yet, a CSV's columns to match, or a file to check before it is added. */
type Flow =
  | { step: 'choose'; problem: string | null }
  | { step: 'match'; session: Generic; focus: MappedField }
  | { step: 'check'; session: ImportSession; writing: ApplyProgress | null };

const PREVIEW_ROWS = 5;
const LISTED_ROWS = 20;
const plural = (count: number, one: string, many = `${one}s`) => `${count.toLocaleString('en-US')} ${count === 1 ? one : many}`;

function Stepper({ step }: { step: ImportStep }) {
  const steps: { key: ImportStep; label: string }[] = [
    { key: 'choose', label: 'Choose a file' },
    { key: 'match', label: 'Match columns' },
    { key: 'check', label: 'Check the file' },
  ];
  const at = steps.findIndex((each) => each.key === step);
  return (
    <ol aria-label="Import steps" className="import-steps">
      {steps.map((each, index) => {
        const state = index < at ? 'done' : index === at ? 'now' : 'next';
        return [
          index > 0 && <li key={`${each.key}-rule`} aria-hidden="true" className="step-rule" data-done={index <= at || undefined} />,
          <li key={each.key} data-state={state} aria-current={state === 'now' ? 'step' : undefined}>
            <span className="step-dot num">{state === 'done' ? <Mdi path={SETTINGS_ICONS.check} size={15} /> : index + 1}</span>
            {each.label}
          </li>,
        ];
      })}
    </ol>
  );
}

/** W2-Data's picker, with the chosen column's letter in front. */
function Picker({
  label,
  value,
  options,
  placeholder,
  lead,
  focused,
  empty,
  onFocus,
  onChange,
}: {
  label: string;
  value: string | null;
  options: { value: string; label: string }[];
  placeholder?: string;
  lead: ReactNode;
  focused?: boolean;
  empty?: boolean;
  onFocus?: () => void;
  onChange: (value: string) => void;
}) {
  return (
    <span className="pick" data-focus={focused || undefined} data-empty={empty || undefined} onFocus={onFocus}>
      <Select label={label} className="pick-trigger" value={value} placeholder={placeholder} lead={lead} options={options} onChange={onChange} />
    </span>
  );
}

function MapRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="map-row">
      <div className="map-line">
        <span className="map-label">{label}</span>
        {children}
      </div>
    </div>
  );
}

function StatusPill({ read }: { read: PreviewRow['read'] }) {
  if (read.kind === 'problem')
    return (
      <span className="pill-count" data-tone="problem" title={read.reason}>
        Can&apos;t read
      </span>
    );
  if (read.status === 'new')
    return (
      <span className="pill-count" data-tone="new">
        New
      </span>
    );
  if (read.status === 'here') return <span className="pill-count">Already here</span>;
  return null;
}

function RowList({ title, rows, currency, today }: { title: string; rows: readonly ImportRow[]; currency: string; today: DayKey }) {
  if (!rows.length) return null;
  return (
    <section className="check-list" aria-label={title}>
      <h3 className="caps">
        {rows.length.toLocaleString('en-US')} {title.toLowerCase()}
      </h3>
      {rows.slice(0, LISTED_ROWS).map((row) => (
        <div key={row.line} className="check-row">
          <span className="set-row-text">
            <span>{row.merchant ?? row.note ?? 'No merchant'}</span>
            <span className="set-row-meta">{dayLabel(row.day, today)}</span>
          </span>
          <span className="num">{formatSignedMoney(row.type, row.amountMinor, currency)}</span>
        </div>
      ))}
      {rows.length > LISTED_ROWS && <div className="check-row set-row-meta">and {plural(rows.length - LISTED_ROWS, 'more row')}</div>}
    </section>
  );
}

/**
 * Settings › Import and export (W2-Data): choose or drop a file, match a CSV's columns beside a live
 * preview of how Moni reads its first rows, then check the new and already-here rows before Add writes
 * them. A Moni export goes straight to Check the file. Nothing is written before Add, and the toast's
 * Undo soft-deletes exactly the rows it added.
 */
export function ImportSection() {
  const { user } = useShellApi();
  const ledger = useLedger();
  const store = moniStore();
  const ready = useValue(() => storeHasPulled(moniStore()));
  const [flow, setFlow] = useState<Flow>({ step: 'choose', problem: null });
  const [dragging, setDragging] = useState(false);
  const [moreFields, setMoreFields] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const today = ledger.calendar.dayKey(ledger.now);
  const target = useMemo(
    () => ({ userId: user.id, aliases: ledger.aliases, calendar: ledger.calendar }),
    [user.id, ledger.aliases, ledger.calendar],
  );
  // The store as it is now; `ledger.projection` changes whenever a synced row does.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const snapshot = useMemo(() => readStoreSnapshot(store), [store, ledger.projection]);

  const session = flow.step === 'choose' ? null : flow.session;
  const plan: ImportPlan | null = useMemo(() => {
    if (!session || !ready) return null;
    if (session.kind === 'generic' && !mappingIsComplete(session.choices.mapping)) return null;
    return planImport(session, snapshot, target);
  }, [session, snapshot, target, ready]);
  const counts = plan ? importCounts(plan) : null;

  const open = async (file: File | undefined) => {
    if (!file) return;
    try {
      const read = readImportFile(file.name, new Uint8Array(await file.arrayBuffer()), user.id);
      if (read.kind === 'problem') setFlow({ step: 'choose', problem: read.reason });
      else if (read.session.kind === 'restore') setFlow({ step: 'check', session: read.session, writing: null });
      else setFlow({ step: 'match', session: read.session, focus: 'date' });
    } catch {
      setFlow({ step: 'choose', problem: "That file can't be opened. Try again." });
    }
  };
  const chooseAnother = () => {
    setFlow({ step: 'choose', problem: null });
    if (fileInput.current) fileInput.current.value = '';
  };

  const generic = session?.kind === 'generic' ? session : null;
  const wallet = generic?.choices.wallet ? ledger.wallets.find((each) => each.id === generic.choices.wallet?.id) ?? null : null;
  const currency = wallet?.currency ?? ledger.currency;
  const missing = !generic ? null : !generic.choices.wallet ? 'Choose a wallet' : !mappingIsComplete(generic.choices.mapping) ? 'Choose the date and amount' : null;

  const setChoices = (patch: Partial<Generic['choices']>) => {
    if (flow.step !== 'match') return;
    setFlow({ ...flow, session: { ...flow.session, choices: { ...flow.session.choices, ...patch } } });
  };

  const add = async () => {
    if (flow.step !== 'check' || flow.writing) return;
    const latest = planImport(flow.session, readStoreSnapshot(store), target);
    if (!latest) return;
    const total = importCounts(latest).fresh;
    const ids: string[] = [];
    setFlow({ ...flow, writing: { done: 0, total } });
    try {
      const written = await applyPlan(store, latest, {
        newId: () => {
          const id = crypto.randomUUID();
          ids.push(id);
          return id;
        },
        onProgress: (progress) => setFlow((now) => (now.step === 'check' ? { ...now, writing: progress } : now)),
      });
      const rows = writtenRows(latest, ids);
      chooseAnother();
      const restore = latest.kind === 'restore';
      showToast({
        text: written ? `${restore ? 'Restored' : 'Added'} ${plural(written, restore ? 'row' : 'transaction')}` : 'Nothing new to add',
        tone: 'done',
        undo: rows.length
          ? () => {
              try {
                applyWrites(store, undoImport(rows, new Date().toISOString()));
              } catch {
                showToast({ text: "Couldn't undo: some of those rows changed since.", tone: 'error' });
              }
            }
          : undefined,
      });
    } catch {
      setFlow((now) => (now.step === 'check' ? { ...now, writing: null } : now));
      showToast({ text: "Couldn't finish. Import the file again: nothing adds twice.", tone: 'error' });
    }
  };

  const toCheck = () => {
    if (flow.step === 'match' && !missing) setFlow({ step: 'check', session: flow.session, writing: null });
  };
  const back = () => {
    if (flow.step === 'check' && !flow.writing) {
      if (flow.session.kind === 'generic') setFlow({ step: 'match', session: flow.session, focus: 'date' });
      else chooseAnother();
    } else if (flow.step === 'match') chooseAnother();
  };

  useScreenKeys((key, event) => {
    // A focused button or link answers Enter itself.
    if (event.target instanceof HTMLElement && event.target.closest('button, a')) return false;
    if (key === 'Enter') {
      if (flow.step === 'match' && !missing) toCheck();
      else if (flow.step === 'check' && counts?.fresh) void add();
      else return false;
      return true;
    }
    if (key === 'Escape' && flow.step !== 'choose') {
      back();
      return true;
    }
    return false;
  });

  const step: ImportStep = flow.step;
  const fileStrip = session && (
    <div className="file-strip">
      <span className="file-icon">
        <Mdi path={SETTINGS_ICONS.csv} size={22} />
      </span>
      <span className="file-text">
        <span className="file-name">{session.fileName}</span>
        <span className="file-meta num">
          {session.kind === 'generic'
            ? `${plural(session.table.rows.length, 'row')} and ${plural(session.table.headers.length, 'column')}. Not a Moni export, so match its columns.`
            : 'A Moni export from this account. It restores what this browser doesn’t hold.'}
        </span>
      </span>
      <button type="button" className="text-link press" onClick={chooseAnother} disabled={flow.step === 'check' && flow.writing !== null}>
        Choose another file
      </button>
    </div>
  );

  return (
    <section className="set-card" aria-labelledby="import-title" data-import-step={step}>
      <div className="set-head">
        <h2 id="import-title" className="set-title">
          Import data
        </h2>
        <span className="desktop-only">
          <Stepper step={step} />
        </span>
        <ExportDataButton userId={user.id} zone={user.zone} />
      </div>

      <p className="desktop-only-note set-note">
        <b>Import from a computer</b>
        <span>Matching a CSV&apos;s columns needs a bigger screen. Open Moni on a computer to import a file; Export data works here.</span>
      </p>

      <div className="import-flow desktop-only">
        {flow.step === 'choose' && (
          <>
            {flow.problem && (
              <div className="import-problem" role="alert">
                {flow.problem}
              </div>
            )}
            <div
              className="drop-zone"
              data-over={dragging || undefined}
              onDragOver={(event) => {
                event.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(event) => {
                event.preventDefault();
                setDragging(false);
                if (ready) void open(event.dataTransfer.files[0]);
              }}
            >
              <Mdi path={SETTINGS_ICONS.upload} size={32} />
              <h3>{ready ? 'Drop a CSV here' : 'Moni is still loading your data'}</h3>
              <p>
                {ready
                  ? 'A bank statement, another app’s export, or a Moni export to restore. You see what is new before anything is added.'
                  : 'Importing opens once every row has arrived, so Moni can tell new rows from ones it already has.'}
              </p>
              <input
                ref={fileInput}
                type="file"
                accept=".csv,text/csv,text/plain"
                hidden
                aria-label="CSV file to import"
                onChange={(event) => void open(event.target.files?.[0])}
              />
              <button type="button" className="btn btn-ink press" disabled={!ready} onClick={() => fileInput.current?.click()}>
                <Mdi path={SETTINGS_ICONS.csv} size={20} />
                Choose a file
              </button>
            </div>
          </>
        )}

        {flow.step === 'match' && (
          <>
            {fileStrip}
            <MatchColumns
              flow={flow}
              ledger={ledger}
              snapshot={snapshot}
              target={target}
              today={today}
              wallet={wallet}
              currency={currency}
              moreFields={moreFields}
              onMoreFields={() => setMoreFields(true)}
              onFocus={(focus) => setFlow({ ...flow, focus })}
              onChoices={setChoices}
            />
            <div className="import-foot">
              <span className="num" style={{ fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap' }}>
                {plural(flow.session.table.rows.length, 'row')}
              </span>
              {counts ? (
                <>
                  <span className="pill-count num" data-tone="new" data-testid="import-new">
                    {counts.fresh.toLocaleString('en-US')} new
                  </span>
                  <span className="pill-count num" data-testid="import-here">
                    {counts.here.toLocaleString('en-US')} already here
                  </span>
                  {counts.problems > 0 && (
                    <span className="pill-count num" data-tone="problem">
                      {counts.problems.toLocaleString('en-US')} can&apos;t be read
                    </span>
                  )}
                </>
              ) : null}
              <span className="import-foot-note">{missing && `${missing} to see what is new.`}</span>
              <button type="button" className="btn btn-sand press" onClick={back}>
                Back
              </button>
              <button type="button" className="btn btn-ink press" disabled={missing !== null} onClick={toCheck}>
                Check the file
                <span className="kbd kbd-on-ink">Enter</span>
              </button>
            </div>
          </>
        )}

        {flow.step === 'check' && (
          <>
            {fileStrip}
            {!plan || !counts ? (
              <div className="drop-zone">
                <h3>Moni is still loading your data</h3>
              </div>
            ) : plan.kind === 'restore' ? (
              <section className="check-list" aria-label="What the export holds">
                {TABLE_ORDER.filter((table) => plan.counts[table].fresh + plan.counts[table].here > 0).map((table) => (
                  <div key={table} className="check-row">
                    <span className="set-row-text">
                      <span>{TABLES[table].title}</span>
                    </span>
                    <span className="num">
                      {plan.counts[table].fresh} new, {plan.counts[table].here} already here
                    </span>
                  </div>
                ))}
              </section>
            ) : (
              <div className="check-lists">
                <RowList title="New" rows={plan.fresh} currency={currency} today={today} />
                <RowList title="Already here" rows={plan.here} currency={currency} today={today} />
              </div>
            )}
            {plan && plan.problems.length > 0 && (
              <section className="check-list" aria-label="Rows that can't be read">
                <h3 className="caps">{plan.problems.length} can&apos;t be read</h3>
                {plan.problems.slice(0, LISTED_ROWS).map((problem) => (
                  <div key={`${problem.line}-${problem.reason}`} className="check-row">
                    <span className="set-row-text">
                      <span>Line {problem.line}</span>
                      <span className="set-row-meta">{problem.reason}</span>
                    </span>
                  </div>
                ))}
              </section>
            )}
            {flow.writing && (
              <div className="import-progress" role="progressbar" aria-label="Adding" aria-valuemin={0} aria-valuemax={flow.writing.total} aria-valuenow={flow.writing.done}>
                <span style={{ width: `${flow.writing.total ? (flow.writing.done / flow.writing.total) * 100 : 100}%` }} />
              </div>
            )}
            <div className="import-foot">
              {counts && (
                <>
                  <span className="pill-count num" data-tone="new" data-testid="import-new">
                    {counts.fresh.toLocaleString('en-US')} new
                  </span>
                  <span className="pill-count num" data-testid="import-here">
                    {counts.here.toLocaleString('en-US')} already here
                  </span>
                </>
              )}
              <span className="import-foot-note">
                {flow.writing
                  ? `${flow.writing.done} of ${flow.writing.total} added`
                  : counts?.fresh
                    ? `Only the new ${counts.fresh === 1 ? 'row is' : 'rows are'} added${wallet ? `, to ${wallet.name}` : ''}. Undo takes them out again.`
                    : 'Everything in this file is already in Moni.'}
              </span>
              <button type="button" className="btn btn-sand press" onClick={back} disabled={flow.writing !== null}>
                Back
              </button>
              <button type="button" className="btn btn-ink press" disabled={!counts?.fresh || flow.writing !== null} aria-busy={flow.writing !== null} onClick={() => void add()}>
                {counts?.fresh ? (session?.kind === 'restore' ? 'Restore' : 'Add') : 'Nothing to add'}
                <span className="kbd kbd-on-ink">Enter</span>
              </button>
            </div>
          </>
        )}
      </div>
    </section>
  );
}

function MatchColumns({
  flow,
  ledger,
  snapshot,
  target,
  today,
  wallet,
  currency,
  moreFields,
  onMoreFields,
  onFocus,
  onChoices,
}: {
  flow: Extract<Flow, { step: 'match' }>;
  ledger: Ledger;
  snapshot: StoreSnapshot;
  target: { userId: string; aliases: Ledger['aliases']; calendar: Ledger['calendar'] };
  today: DayKey;
  wallet: Ledger['wallets'][number] | null;
  currency: string;
  moreFields: boolean;
  onMoreFields: () => void;
  onFocus: (field: MappedField) => void;
  onChoices: (patch: Partial<Generic['choices']>) => void;
}) {
  const { table, choices } = flow.session;
  const { mapping, order } = choices;
  const columns = table.headers.map((header, index) => ({ value: String(index), label: header || `Column ${index + 1}` }));
  const options = [{ value: 'none', label: 'Not in the file' }, ...columns];
  const hint = choices.orderSettled ? null : dateOrderHint(table, mapping, target.calendar);
  const preview = previewRows(table, mapping, order, PREVIEW_ROWS, {
    ...target,
    store: snapshot,
    wallet: choices.wallet,
    today,
  });
  const fieldOf = new Map<number, MappedField>();
  for (const [field, column] of Object.entries(mapping) as [MappedField, number | null][]) if (column !== null && !fieldOf.has(column)) fieldOf.set(column, field);
  const shownColumns = [...fieldOf.keys()].sort((a, b) => a - b).slice(0, 4);
  const shown = shownColumns.length ? shownColumns : table.headers.slice(0, 3).map((_, index) => index);
  const lit = mapping[flow.focus];

  const lead = (column: number | null) =>
    column === null ? (
      <span className="col-none">
        <Mdi path={SETTINGS_ICONS.none} size={14} />
      </span>
    ) : (
      <span className="col-letter">{columnLetter(column)}</span>
    );
  const pickField = (field: MappedField, label: string) => (
    <MapRow key={field} label={label}>
      <Picker
        label={`${label} column`}
        value={mapping[field] === null ? 'none' : String(mapping[field])}
        options={options}
        lead={lead(mapping[field])}
        empty={mapping[field] === null}
        focused={flow.focus === field}
        onFocus={() => onFocus(field)}
        onChange={(value) => onChoices({ mapping: { ...mapping, [field]: value === 'none' ? null : Number(value) } })}
      />
    </MapRow>
  );
  const extra = MORE_FIELDS.filter((each) => moreFields || mapping[each.field] !== null);

  const readLine = (row: PreviewRow, column: number): ReactNode => {
    const field = fieldOf.get(column);
    if (row.read.kind === 'problem') return field === 'date' ? <span className="p-read" data-tone="problem">{row.read.reason}</span> : null;
    if (field === 'date') return <span className="p-read num">{row.read.dateLabel}</span>;
    if (field === 'merchant') {
      const named = row.read.merchant !== (row.cells[column] ?? '').trim() && row.read.merchant;
      return (
        <span className="p-read" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          {named && <Mdi path={SETTINGS_ICONS.store} size={13} />}
          {row.read.merchant ?? '—'}
        </span>
      );
    }
    if (field === 'amount' || field === 'moneyOut' || field === 'moneyIn')
      return (
        <span className="p-read num" data-tone={row.read.type === 'income' ? 'income' : undefined}>
          {formatSignedMoney(row.read.type, Math.abs(row.read.signedMinor), currency)}
        </span>
      );
    return null;
  };
  const isAmount = (column: number) => ['amount', 'moneyOut', 'moneyIn'].includes(fieldOf.get(column) ?? '');

  return (
    <div className="import-body">
      <div className="map-fields">
        <span className="caps" style={{ color: 'var(--color-muted)' }}>
          Match Moni fields to your file
        </span>
        <MapRow label="Wallet">
          <Picker
            label="Wallet to add to"
            value={choices.wallet?.id ?? null}
            placeholder="Choose a wallet"
            empty={!wallet}
            options={ledger.wallets.map((each) => ({ value: each.id, label: each.name }))}
            lead={wallet ? <Bubble icon={wallet.icon} color={wallet.color} size={26} glyph={14} /> : lead(null)}
            onChange={(id) => {
              const chosen = ledger.wallets.find((each) => each.id === id);
              onChoices({ wallet: chosen ? { id: chosen.id, currency: chosen.currency } : null });
            }}
          />
        </MapRow>
        <span aria-hidden="true" className="map-rule" />
        {pickField('date', 'Date')}
        {hint && (
          <div className="map-row" style={{ paddingLeft: 88 }}>
            <div className="order-seg" role="group" aria-label="How dates are written">
              <span className="order-pill" aria-hidden="true" data-at={order} />
              <button type="button" aria-pressed={order === 'dmy'} onClick={() => onChoices({ order: 'dmy' })}>
                Day first
              </button>
              <button type="button" aria-pressed={order === 'mdy'} onClick={() => onChoices({ order: 'mdy' })}>
                Month first
              </button>
            </div>
            <span className="map-help">
              {hint}
            </span>
          </div>
        )}
        {BOARD_FIELDS.filter((each) => each.field !== 'date').map((each) => pickField(each.field, each.label))}
        {extra.map((each) => pickField(each.field, each.label))}
        {!moreFields && extra.length < MORE_FIELDS.length && (
          <button type="button" className="text-link map-more press" onClick={onMoreFields}>
            More fields
          </button>
        )}
      </div>

      <div className="preview">
        <div className="preview-head">
          <span className="caps" style={{ color: 'var(--color-muted)' }}>
            First {Math.min(PREVIEW_ROWS, table.rows.length)} of {plural(table.rows.length, 'row')} in your file
          </span>
        </div>
        <div role="table" aria-label="First rows of the file" className="preview-table">
          <div role="row" className="ptr ptr-head">
            {shown.map((column) => (
              <div role="columnheader" key={column} className="pth" data-field={fieldOf.get(column)} data-lit={lit === column || undefined} data-align={isAmount(column) ? 'end' : undefined} data-column={column}>
                <span className="col-letter">{columnLetter(column)}</span>
                <span>{table.headers[column] || `Column ${column + 1}`}</span>
              </div>
            ))}
            <div role="columnheader" className="pth p-status" data-align="end" style={{ color: 'var(--color-muted)' }}>
              In Moni
            </div>
          </div>
          {preview.map((row) => (
            <div role="row" key={row.line} className="ptr" data-line={row.line}>
              {shown.map((column) => (
                <div role="cell" key={column} className="ptd" data-field={fieldOf.get(column)} data-lit={lit === column || undefined} data-align={isAmount(column) ? 'end' : undefined}>
                  <span className="num">{row.cells[column] ?? ''}</span>
                  {readLine(row, column)}
                </div>
              ))}
              <div role="cell" className="ptd p-status" data-align="end">
                <StatusPill read={row.read} />
              </div>
            </div>
          ))}
          {table.rows.length > PREVIEW_ROWS && <div className="p-more">and {plural(table.rows.length - PREVIEW_ROWS, 'more row')}</div>}
        </div>
      </div>
    </div>
  );
}
