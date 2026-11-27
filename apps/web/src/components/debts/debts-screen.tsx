'use client';

import {
  dateLabel,
  dayOfMonth,
  daysBetween,
  DEBT_SIDES,
  DEBT_STATUS_CHOICES,
  dueWords,
  filterDebts,
  formatMoney,
  tickedChoices,
  planDebt,
  planDebtActivity,
  planDebtActivityDelete,
  planDebtDelete,
  weekdayShort,
  type DebtFilter,
  type DebtLine,
  type NewDebt,
} from '@repo/core';
import type { MinorAmount } from '@repo/types';
import { useState } from 'react';
import { Cat } from '@/components/brand';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { Check, FilterChip } from '@/components/activity/filters';
import { Glyph, PersonTile } from '@/components/ledger/glyph';
import { useQueryParams, useStepBack } from '@/components/ledger/use-query-param';
import { SlideOver } from '@/components/ledger/slide-over';
import { Page } from '@/components/shell/page';
import { showToast } from '@/components/shell/shell-store';
import {
  comingUpWords,
  debtMoney,
  deleteWords,
  netLabel,
  NO_WALLET,
  openLabel,
  owedBar,
  personMeta,
  readChoices,
  repayWallet,
  SIDE_LABEL,
  sideOptions,
  STATUS_LABEL,
  statusOptions,
  tickedLabel,
  toggleChoice,
  writeOffWords,
  type FilterOption,
} from '@/lib/debts-view';
import { applyPlan, commit, ledgerViewNow, planContext } from '@/lib/ledger/commit';
import { useLedger, type Ledger } from '@/lib/ledger/use-ledger';
import { useScreenKeys } from '@/lib/screen-keys';
import { PersonPane, type RepayDraft } from './person-pane';
import { RecordDebt, type DebtDraft } from './record-debt';
import { useDebts, type DebtsData } from './use-debts';
import '@/components/ledger/ledger.css';
import '@/components/ledger/table-pane.css';
import './debts.css';

type Side = 'owed_to_me' | 'i_owe';

export function DebtsScreen() {
  const ledger = useLedger();
  if (!ledger.loaded) {
    return (
      <Page title="Debts" phone="tab">
        <div className="ledger" aria-busy="true">
          <div className="ledger-main">
            <div className="card skeleton" style={{ height: 120 }} />
            <div className="card skeleton" style={{ height: 320 }} />
          </div>
        </div>
      </Page>
    );
  }
  return <DebtsLoaded ledger={ledger} />;
}

/** A new debt starts as a record only, as on the phone: Money didn't leave my wallet. */
function emptyDraft(name = '', direction: Side = 'owed_to_me'): DebtDraft {
  return { direction, name, amount: '', walletId: NO_WALLET, dueDate: '', note: '' };
}

function DebtsLoaded({ ledger }: { ledger: Ledger }) {
  const data = useDebts(ledger);
  const { summary } = data;
  const [params, setParams] = useQueryParams();
  const currency = ledger.currency;
  const today = ledger.calendar.dayKey(ledger.now);
  const filter: DebtFilter = { sides: readChoices(params.get('side'), DEBT_SIDES), statuses: readChoices(params.get('status'), DEBT_STATUS_CHOICES) };
  const view = filterDebts(summary, filter);
  const order = view.lines;
  const recording = params.get('record') === 'debt';
  const selectedId = recording ? null : params.get('person');
  const selected = data.allLines.find((line) => line.debt.id === selectedId) ?? null;
  const index = selected ? order.findIndex((line) => line.debt.id === selected.debt.id) : -1;
  const [repay, setRepay] = useState<RepayDraft | null>(null);
  const [draft, setDraft] = useState<DebtDraft>(() => emptyDraft());
  const [reminded, setReminded] = useState<Set<string>>(() => new Set());
  const [writingOffId, setWritingOffId] = useState<string | null>(null);
  const writingOff = data.allLines.find((line) => line.debt.id === writingOffId && line.state === 'open') ?? null;
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const deleting = data.allLines.find((line) => line.debt.id === deletingId) ?? null;
  const empty = summary.open.length === 0 && summary.closed.length === 0;

  const select = (debtId: string | null) => {
    if (repay && repay.debtId !== debtId) setRepay(null);
    setParams({ person: debtId, record: null }, debtId && !selectedId && !recording ? 'push' : 'replace');
  };
  const close = useStepBack(Boolean(selectedId) || recording, () => setParams({ person: null, record: null }));
  /** Picking the open person again closes their pane. */
  const pick = (debtId: string) => select(debtId === selectedId ? null : debtId);
  const move = (by: 1 | -1) => {
    if (!order.length) return;
    const next = index < 0 ? (by === 1 ? 0 : order.length - 1) : Math.min(order.length - 1, Math.max(0, index + by));
    select(order[next]!.debt.id);
  };
  const startRecord = (name = '', direction: Side = 'owed_to_me') => {
    setRepay(null);
    setDraft(emptyDraft(name, direction));
    setParams({ record: 'debt', person: null }, selectedId || recording ? 'replace' : 'push');
  };
  const startRepay = (line: DebtLine | null = selected) => {
    if (!line || line.state !== 'open') return;
    const inCurrency = data.wallets.filter((wallet) => wallet.currency === line.debt.currency).map((wallet) => wallet.id);
    const usual = line.debt.currency === currency ? data.defaultWalletId : (inCurrency[0] ?? null);
    setRepay({
      debtId: line.debt.id,
      amount: (line.balanceMinor / 100).toFixed(2),
      walletId: repayWallet(line, data.activitiesOf(line.debt.id), inCurrency, usual),
    });
    if (selectedId !== line.debt.id) setParams({ person: line.debt.id, record: null }, selectedId || recording ? 'replace' : 'push');
  };

  const remind = async (line: DebtLine | null = selected) => {
    if (!line || line.state !== 'open' || line.debt.direction !== 'owed_to_me') return;
    const name = line.debt.counterpartyName;
    const due = line.debt.dueDate ? `, due ${dateLabel(line.debt.dueDate, today)}` : '';
    const text = `Hi ${name}, a reminder about the ${formatMoney(line.balanceMinor, line.debt.currency)}${line.debt.note ? ` for ${line.debt.note.toLowerCase()}` : ''}${due}. Thanks!`;
    let shared = false;
    try {
      if (navigator.share) {
        await navigator.share({ text });
        shared = true;
      }
    } catch {
      return;
    }
    if (!shared) await navigator.clipboard?.writeText(text).catch(() => {});
    setReminded((current) => new Set(current).add(line.debt.id));
    showToast({ text: shared ? `Reminder sent to ${name}` : `Reminder copied. Paste it in a chat with ${name}.`, tone: 'done' });
  };

  const saveRepay = (line: DebtLine, amountMinor: MinorAmount, walletId: string | null, activityDate: string) => {
    const recorded = commit(
      planDebtActivity(
        line.debt,
        { kind: 'repayment', amountMinor, walletId: walletId === NO_WALLET ? null : walletId, activityDate },
        ledger.projection,
        planContext(ledger.userId),
      ),
      `Recorded ${formatMoney(amountMinor, line.debt.currency)}`,
      ({ activity }) => applyPlan(planDebtActivityDelete(line.debt, activity.id, ledgerViewNow(), { now: new Date().toISOString() })),
    );
    if (recorded) setRepay(null);
  };

  const writeOff = (line: DebtLine) => {
    commit(
      planDebtActivity(line.debt, { kind: 'write_off', amountMinor: line.balanceMinor }, ledger.projection, planContext(ledger.userId)),
      `Wrote off ${formatMoney(line.balanceMinor, line.debt.currency)} with ${line.debt.counterpartyName}`,
      ({ activity }) => applyPlan(planDebtActivityDelete(line.debt, activity.id, ledgerViewNow(), { now: new Date().toISOString() })),
    );
  };

  /** The debt, every entry on it and their wallet rows go in one write; the toast's Undo brings them all back. */
  const removeDebt = (line: DebtLine) => {
    const removed = commit(planDebtDelete(line.debt, ledgerViewNow(), { now: new Date().toISOString() }), `Deleted the debt with ${line.debt.counterpartyName}`);
    if (removed && selectedId === line.debt.id) setParams({ person: null });
  };

  /** As on the phone: every debt recorded is its own, even with someone who already owes the same way. */
  const saveDebt = (input: NewDebt) => {
    const now = () => new Date().toISOString();
    const recorded = commit(
      planDebt(input, ledger.projection, planContext(ledger.userId)),
      ({ debt }) => `Recorded a debt with ${debt.counterpartyName}`,
      ({ debt }) => {
        applyPlan(planDebtDelete(debt, ledgerViewNow(), { now: now() }));
        setParams({ person: null });
      },
    );
    if (!recorded) return;
    setDraft(emptyDraft());
    setParams({ record: null, person: recorded.result.debt.id });
  };

  useScreenKeys((key) => {
    switch (key) {
      case 'j':
        move(1);
        return true;
      case 'k':
        move(-1);
        return true;
      case 'r':
        startRepay();
        return true;
      case 'm':
        void remind();
        return true;
      case 'd':
        startRecord();
        return true;
      case 'Escape':
        if (repay) setRepay(null);
        else if (recording || selectedId) close();
        else return false;
        return true;
      default:
        return false;
    }
  });

  const recordButton = !empty && (
    <button type="button" className="btn btn-ink press record-btn" onClick={() => startRecord()}>
      <Glyph name="plus" />
      Record a debt
      <span className="kbd kbd-on-ink">D</span>
    </button>
  );
  const paneOpen = Boolean(selected) || recording;

  return (
    <Page title="Debts" phone="tab" actions={recordButton || undefined}>
      <div className="ledger" data-screen="debts">
        <div className="ledger-main">
          {empty ? (
            <section className="card debts-empty empty">
              <Cat mood="happy" size={72} id="debts-empty" />
              <h2 className="empty-title">No debts yet</h2>
              <p className="empty-line">Lent a friend money, or they covered you? Note it here. Moni shows who owes who.</p>
              <button type="button" className="btn btn-ink press" onClick={() => startRecord()}>
                <Glyph name="plus" />
                Record a debt
                <span className="kbd kbd-on-ink">D</span>
              </button>
            </section>
          ) : (
            <>
              <NetStrip data={data} currency={currency} />
              <button type="button" className="card record-card press" data-only="phone" onClick={() => startRecord()}>
                <span className="record-plus">
                  <Glyph name="plus" />
                </span>
                <b>Record a debt</b>
                <Glyph name="chevron-right" />
              </button>
              {view.comingUp.length > 0 && (
                <section className="card coming-up" aria-label="Coming up">
                  <div className="coming-head">
                    <span className="caps">Coming up</span>
                    <span className="coming-note">
                      <Glyph name="bell-outline" size={15} />
                      Moni reminds you the day before
                    </span>
                  </div>
                  {view.comingUp.map(({ line, dueDate, daysLeft }) => {
                    const words = comingUpWords(line, daysLeft);
                    return (
                      <div key={line.debt.id} className="coming-row" data-debt={line.debt.id}>
                        <button type="button" className="coming-open press" aria-current={selectedId === line.debt.id || undefined} onClick={() => select(line.debt.id)}>
                          <span className="date-tile">
                            <span className="caps">{weekdayShort(dueDate)}</span>
                            <b className="num">{dayOfMonth(dueDate)}</b>
                          </span>
                          <span className="row-text">
                            <b>{words.title}</b>
                            <span className={daysLeft < 0 ? 'tone-over' : undefined}>{words.meta}</span>
                          </span>
                          <span className="coming-chevron" data-only="phone rail-one-column">
                            <Glyph name="chevron-right" />
                          </span>
                        </button>
                        {line.debt.direction === 'i_owe' && (
                          <button type="button" className="btn btn-ink press" data-only="rail sidebar" onClick={() => startRepay(line)}>
                            Pay
                          </button>
                        )}
                      </div>
                    );
                  })}
                </section>
              )}
              <PeopleCard
                lines={view.lines}
                summary={data.summary}
                filter={filter}
                selectedId={selectedId}
                today={today}
                onPick={pick}
                onFilter={(next) => setParams({ side: next.sides.join(',') || null, status: next.statuses.join(',') || null })}
              />
            </>
          )}
        </div>
        <SlideOver
          label={recording ? 'Record a debt' : 'Debt'}
          name="person"
          back="Debts"
          steps={selected ? { noun: 'debt', position: index >= 0 ? `${index + 1} of ${order.length}` : '', onMove: move, first: index <= 0, last: index === order.length - 1 } : undefined}
          actions={
            selected && !recording ? (
              <button type="button" className="round-btn small pane-delete" onClick={() => setDeletingId(selected.debt.id)} aria-label={`Delete the debt with ${selected.debt.counterpartyName}`}>
                <Glyph name="trash-can-outline" />
              </button>
            ) : undefined
          }
          open={paneOpen}
          onClose={close}
        >
          {recording ? (
            <RecordDebt
              draft={draft}
              onDraft={setDraft}
              data={data}
              currency={currency}
              today={ledger.calendar.dayKey(ledger.now)}
              onSave={saveDebt}
              onClose={close}
            />
          ) : selected ? (
            <PersonPane
              line={selected}
              data={data}
              ledger={ledger}
              repay={repay?.debtId === selected.debt.id ? repay : null}
              reminded={reminded.has(selected.debt.id)}
              onRepay={() => startRepay(selected)}
              onRepayDraft={setRepay}
              onSaveRepay={saveRepay}
              onRemind={() => void remind(selected)}
              onWriteOff={() => setWritingOffId(selected.debt.id)}
              onDelete={() => setDeletingId(selected.debt.id)}
              onRecordAgain={() => startRecord(selected.debt.counterpartyName, selected.debt.direction)}
              onClose={close}
            />
          ) : null}
        </SlideOver>
      </div>
      {writingOff && (
        <ConfirmDialog
          {...writeOffWords(writingOff)}
          action="Write off"
          icon="text-box-remove-outline"
          onCancel={() => setWritingOffId(null)}
          onConfirm={() => {
            setWritingOffId(null);
            writeOff(writingOff);
          }}
        />
      )}
      {deleting && (
        <ConfirmDialog
          {...deleteWords(deleting)}
          action="Delete"
          icon="trash-can-outline"
          onCancel={() => setDeletingId(null)}
          onConfirm={() => {
            setDeletingId(null);
            removeDebt(deleting);
          }}
        />
      )}
    </Page>
  );
}

/** The mint hero, read only: the net, then a bar of what you are owed against what you owe with each total under its end. */
function NetStrip({ data, currency }: { data: DebtsData; currency: string }) {
  const { summary } = data;
  const bar = owedBar(summary);
  const end = (value: Side, icon: 'arrow-bottom-left' | 'arrow-top-right', amount: number) => (
    <span className="net-end" data-side={value}>
      <span className="net-end-label">
        <Glyph name={icon} size={16} />
        {SIDE_LABEL[value]}
      </span>
      <span className="num net-end-amount" data-testid={`net-${value}`}>
        {debtMoney(amount, currency)}
      </span>
    </span>
  );
  return (
    <section className="card net-strip" aria-label="Where you stand">
      <div className="net-words">
        <span className="net-label">{netLabel(summary)}</span>
        <span className="num net-amount" data-testid="net-amount">
          {debtMoney(Math.abs(summary.netMinor), currency)}
        </span>
      </div>
      {bar && (
        <div className="net-split">
          <div className="net-bar" aria-hidden="true">
            {bar.map((part) => (
              <span key={part.side} data-side={part.side} style={{ flexGrow: part.flex }} />
            ))}
          </div>
          <div className="net-ends">
            {end('owed_to_me', 'arrow-bottom-left', summary.owedToMeMinor)}
            {end('i_owe', 'arrow-top-right', summary.iOweMinor)}
          </div>
        </div>
      )}
    </section>
  );
}

/** A Records filter: Activity's chip and its popover of ticks, every choice ticked by default. */
function TickFilter<T extends string>({
  name,
  picked,
  every,
  labels,
  options,
  onChange,
}: {
  name: string;
  picked: readonly T[];
  every: string;
  labels: Record<T, string>;
  options: FilterOption<T>[];
  onChange: (picked: T[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const choices = options.map((option) => option.value);
  const ticked = tickedChoices(picked, choices);
  return (
    <FilterChip label={name} value={tickedLabel(picked, labels, every)} changed={picked.length > 0} open={open} onOpen={setOpen}>
      {options.map((option) => (
        <Check key={option.value} on={ticked.includes(option.value)} onToggle={() => onChange(toggleChoice(picked, option.value, choices))}>
          <span className="popover-row-text">{option.label}</span>
          <span className="num meta">{option.meta}</span>
        </Check>
      ))}
    </FilterChip>
  );
}

function PersonRow({ line, today, selected, onPick }: { line: DebtLine; today: string; selected: boolean; onPick: (id: string) => void }) {
  const { debt } = line;
  const mine = debt.direction === 'owed_to_me';
  const open = line.state === 'open';
  const amount = formatMoney(open ? line.balanceMinor : line.principalMinor, debt.currency);
  const days = debt.dueDate ? daysBetween(today, debt.dueDate) : null;
  return (
    <div
      className="grid-row people-row"
      role="row"
      aria-selected={selected}
      data-debt={debt.id}
      data-state={line.state}
      onClick={() => onPick(debt.id)}
    >
      <span role="rowheader" className="row-name">
        <PersonTile name={debt.counterpartyName} owedToMe={mine} />
        <span className="row-text">
          <b>{debt.counterpartyName}</b>
          <span>{personMeta(line, today, line.startedAt.slice(0, 10))}</span>
        </span>
      </span>
      <span role="gridcell" className="due-cell" data-col="due">
        {!open ? (
          <span className="meta">{line.state === 'settled' ? 'Paid in full' : 'Written off'}</span>
        ) : debt.dueDate && days !== null ? (
          <span className="row-text">
            <b className="due-date">{dateLabel(debt.dueDate, today)}</b>
            <span className={days < 0 ? 'tone-over' : undefined}>{dueWords(days)}</span>
          </span>
        ) : (
          <span className="meta">No date</span>
        )}
      </span>
      <span role="gridcell" className={`num amount-cell ${open ? 'tone-in' : 'tone-quiet'}`} data-col="owes-you">
        {mine ? amount : ''}
      </span>
      <span role="gridcell" className={`num amount-cell ${open ? '' : 'tone-quiet'}`} data-col="you-owe">
        {mine ? '' : amount}
      </span>
      <span className="phone-amount num" data-only="phone">
        <span className={mine && open ? 'tone-in' : undefined}>{amount}</span>
        <span className="meta">{open ? (mine ? 'owes you' : 'you owe') : line.state === 'settled' ? 'settled' : 'written off'}</span>
      </span>
      <button
        type="button"
        className="row-more"
        aria-label={`${debt.counterpartyName}, open`}
        onClick={(event) => {
          event.stopPropagation();
          onPick(debt.id);
        }}
      >
        <Glyph name="dots-horizontal" />
      </button>
    </div>
  );
}

function PeopleCard({
  lines,
  summary,
  filter,
  selectedId,
  today,
  onPick,
  onFilter,
}: {
  lines: readonly DebtLine[];
  summary: DebtsData['summary'];
  filter: DebtFilter;
  selectedId: string | null;
  today: string;
  onPick: (id: string) => void;
  onFilter: (filter: DebtFilter) => void;
}) {
  const open = lines.filter((line) => line.state === 'open');
  const sum = (direction: Side) => open.filter((line) => line.debt.direction === direction).reduce((total, line) => total + line.balanceMinor, 0);
  const onlyOpen = filter.statuses.length === 1 && filter.statuses[0] === 'open';
  const allSettled = onlyOpen && summary.open.length === 0;
  return (
    <section className="card people-card" aria-label="Records">
      <div className="card-head people-head">
        <h2 className="card-title">Records</h2>
        <div className="people-filters" role="group" aria-label="Filters">
          <TickFilter name="Show" picked={filter.sides} every="Everyone" labels={SIDE_LABEL} options={sideOptions(summary)} onChange={(sides) => onFilter({ ...filter, sides })} />
          <TickFilter name="Status" picked={filter.statuses} every="All" labels={STATUS_LABEL} options={statusOptions(summary)} onChange={(statuses) => onFilter({ ...filter, statuses })} />
        </div>
      </div>
      <div className="people-body" key={`${filter.statuses.join()}-${filter.sides.join()}`}>
        {allSettled ? (
          <div className="dashed-tile all-settled">
            <Cat mood="happy" size={44} id="all-settled" />
            <span>
              <b>Nobody owes anybody</b>
              <br />
              Every debt is paid back. Find them under Settled.
            </span>
          </div>
        ) : lines.length === 0 ? (
          <p className="meta nobody">No debts here right now.</p>
        ) : (
          <div role="grid" aria-label="Debts">
            <div className="grid-head people-row" role="row" data-only="sidebar rail rail-one-column">
              <span role="columnheader" className="caps">
                Who
              </span>
              <span role="columnheader" className="caps" style={{ justifySelf: 'start' }}>
                Due
              </span>
              <span role="columnheader" className="caps">
                Owes you
              </span>
              <span role="columnheader" className="caps">
                You owe
              </span>
              <span />
            </div>
            {lines.map((line) => (
              <PersonRow key={line.debt.id} line={line} today={today} selected={selectedId === line.debt.id} onPick={onPick} />
            ))}
            {open.length > 0 && (
              <div className="grid-total people-row" role="row" data-testid="people-total">
                <b className="open-label">{openLabel(open)}</b>
                <span data-col="due" />
                <span className="num tone-in" data-col="owes-you">
                  {formatMoney(sum('owed_to_me'), summary.currency)}
                </span>
                <span className="num" data-col="you-owe">
                  {formatMoney(sum('i_owe'), summary.currency)}
                </span>
                <span />
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
