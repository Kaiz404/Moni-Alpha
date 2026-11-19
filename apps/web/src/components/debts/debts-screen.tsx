'use client';

import {
  combine,
  dateLabel,
  dayOfMonth,
  daysBetween,
  dueWords,
  formatMoney,
  planDebt,
  planDebtActivity,
  planDebtActivityDelete,
  planDebtDelete,
  planDebtEdit,
  weekdayShort,
  type DebtLine,
  type NewDebt,
  type Planned,
} from '@repo/core';
import type { MinorAmount } from '@repo/types';
import { useState } from 'react';
import { Cat } from '@/components/brand';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { Glyph, PersonTile } from '@/components/ledger/glyph';
import { useQueryParams } from '@/components/ledger/use-query-param';
import { SidePane } from '@/components/ledger/side-pane';
import { Page } from '@/components/shell/page';
import { showToast } from '@/components/shell/shell-store';
import { comingUpWords, netLabel, openLabel, personMeta, writeOffWords } from '@/lib/debts-view';
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

function emptyDraft(walletId: string | null, name = '', direction: Side = 'owed_to_me'): DebtDraft {
  return { direction, name, amount: '', walletId, dueDate: '', note: '' };
}

function DebtsLoaded({ ledger }: { ledger: Ledger }) {
  const data = useDebts(ledger);
  const { summary } = data;
  const [params, setParams] = useQueryParams();
  const currency = ledger.currency;
  const today = ledger.calendar.dayKey(ledger.now);
  const side = (['owed_to_me', 'i_owe'] as const).find((value) => value === params.get('side')) ?? null;
  const open = side ? summary.open.filter((line) => line.debt.direction === side) : summary.open;
  const order = [...open, ...summary.closed];
  const recording = params.get('record') === 'debt';
  const selectedId = recording ? null : params.get('person');
  const selected = data.allLines.find((line) => line.debt.id === selectedId) ?? null;
  const index = selected ? order.findIndex((line) => line.debt.id === selected.debt.id) : -1;
  const [repay, setRepay] = useState<RepayDraft | null>(null);
  const [draft, setDraft] = useState<DebtDraft>(() => emptyDraft(data.defaultWalletId));
  const [reminded, setReminded] = useState<Set<string>>(() => new Set());
  const [writingOffId, setWritingOffId] = useState<string | null>(null);
  const writingOff = data.allLines.find((line) => line.debt.id === writingOffId && line.state === 'open') ?? null;
  const empty = summary.open.length === 0 && summary.closed.length === 0;

  const select = (debtId: string | null) => {
    if (repay && repay.debtId !== debtId) setRepay(null);
    setParams({ person: debtId, record: null });
  };
  /** Picking the open person again closes their pane. */
  const pick = (debtId: string) => select(debtId === selectedId ? null : debtId);
  const move = (by: 1 | -1) => {
    if (!order.length) return;
    const next = index < 0 ? (by === 1 ? 0 : order.length - 1) : Math.min(order.length - 1, Math.max(0, index + by));
    select(order[next]!.debt.id);
  };
  const startRecord = (name = '', direction: Side = 'owed_to_me') => {
    setRepay(null);
    setDraft(emptyDraft(data.defaultWalletId, name, direction));
    setParams({ record: 'debt', person: null });
  };
  const startRepay = (line: DebtLine | null = selected) => {
    if (!line || line.state !== 'open') return;
    setRepay({
      debtId: line.debt.id,
      amount: (line.balanceMinor / 100).toFixed(2),
      walletId: line.debt.currency === currency ? data.defaultWalletId : (data.wallets.find((wallet) => wallet.currency === line.debt.currency)?.id ?? null),
    });
    if (selectedId !== line.debt.id) setParams({ person: line.debt.id, record: null });
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
        { kind: 'repayment', amountMinor, walletId: walletId ?? undefined, activityDate },
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

  /** As on the phone: someone who already owes the same way gets the new amount on that debt. */
  const saveDebt = (input: NewDebt) => {
    const now = () => new Date().toISOString();
    const wallet = data.wallets.find((item) => item.id === input.walletId);
    const existing = data.summary.open.find(
      (line) =>
        line.debt.direction === input.direction &&
        line.debt.currency === wallet?.currency &&
        line.debt.counterpartyName.trim().toLocaleLowerCase() === input.counterpartyName.trim().toLocaleLowerCase(),
    );
    if (existing) {
      const ctx = planContext(ledger.userId);
      const added = planDebtActivity(
        existing.debt,
        { kind: 'principal', amountMinor: input.amountMinor, walletId: input.walletId, note: input.note ?? null },
        ledger.projection,
        ctx,
      );
      const due = input.dueDate ? planDebtEdit(existing.debt, { dueDate: input.dueDate }, ctx) : null;
      const activityId = added.kind === 'writes' ? added.result.activity.id : null;
      const before = existing.debt.dueDate;
      const saved = commit(
        due ? combine<unknown>([added, due]) : (added as Planned<unknown>),
        `Added ${formatMoney(input.amountMinor, existing.debt.currency)} to ${existing.debt.counterpartyName}`,
        () => {
          if (activityId) applyPlan(planDebtActivityDelete(existing.debt, activityId, ledgerViewNow(), { now: now() }));
          if (due) applyPlan(planDebtEdit(existing.debt, { dueDate: before }, { now: now() }));
        },
      );
      if (saved === null) return;
      setDraft(emptyDraft(data.defaultWalletId));
      setParams({ record: null, person: existing.debt.id });
      return;
    }
    const recorded = commit(
      planDebt(input, ledger.projection, planContext(ledger.userId)),
      ({ debt }) => `Recorded a debt with ${debt.counterpartyName}`,
      ({ debt }) => {
        applyPlan(planDebtDelete(debt, ledgerViewNow(), { now: now() }));
        setParams({ person: null });
      },
    );
    if (!recorded) return;
    setDraft(emptyDraft(data.defaultWalletId));
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
        else if (recording) setParams({ record: null });
        else if (selectedId) select(null);
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
              <NetStrip data={data} currency={currency} side={side} onSide={(next) => setParams({ side: next })} />
              <button type="button" className="card record-card press" data-only="phone" onClick={() => startRecord()}>
                <span className="record-plus">
                  <Glyph name="plus" />
                </span>
                <b>Record a debt</b>
                <Glyph name="chevron-right" />
              </button>
              {summary.comingUp.length > 0 && (
                <section className="card coming-up" aria-label="Coming up">
                  <div className="coming-head">
                    <span className="caps">Coming up</span>
                    <span className="coming-note">
                      <Glyph name="bell-outline" size={15} />
                      Moni reminds you the day before
                    </span>
                  </div>
                  {summary.comingUp.map(({ line, dueDate, daysLeft }) => {
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
                open={open}
                summary={data.summary}
                side={side}
                selectedId={selectedId}
                today={today}
                onPick={pick}
                onClearSide={() => setParams({ side: null })}
              />
              {summary.closed.length > 0 && (
                <section className="card people-card" aria-label="Settled">
                  <div className="card-head">
                    <h2 className="card-title settled-title">
                      Settled and written off <span className="num meta">{summary.closed.length}</span>
                    </h2>
                  </div>
                  <div role="grid" aria-label="Settled debts">
                    {summary.closed.map((line) => (
                      <PersonRow key={line.debt.id} line={line} today={today} selected={selectedId === line.debt.id} onPick={pick} />
                    ))}
                  </div>
                </section>
              )}
            </>
          )}
        </div>
        <SidePane label={recording ? 'Record a debt' : 'Person'} name="person" open={Boolean(paneOpen)} onClose={() => (recording ? setParams({ record: null }) : select(null))}>
          {recording ? (
            <RecordDebt
              draft={draft}
              onDraft={setDraft}
              data={data}
              currency={currency}
              today={ledger.calendar.dayKey(ledger.now)}
              onSave={saveDebt}
              onClose={() => setParams({ record: null })}
            />
          ) : selected ? (
            <PersonPane
              line={selected}
              index={index}
              count={order.length}
              data={data}
              ledger={ledger}
              repay={repay?.debtId === selected.debt.id ? repay : null}
              reminded={reminded.has(selected.debt.id)}
              onRepay={() => startRepay(selected)}
              onRepayDraft={setRepay}
              onSaveRepay={saveRepay}
              onRemind={() => void remind(selected)}
              onWriteOff={() => setWritingOffId(selected.debt.id)}
              onRecordAgain={() => startRecord(selected.debt.counterpartyName, selected.debt.direction)}
              onMove={move}
              onClose={() => select(null)}
            />
          ) : null}
        </SidePane>
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
    </Page>
  );
}

function NetStrip({ data, currency, side, onSide }: { data: DebtsData; currency: string; side: Side | null; onSide: (side: Side | null) => void }) {
  const { summary } = data;
  const whole = (minor: number) => formatMoney(minor, currency, { whole: true });
  const tile = (value: Side, label: string, icon: 'arrow-bottom-left' | 'arrow-top-right', amount: number) => (
    <button type="button" className="net-tile press" aria-pressed={side === value} onClick={() => onSide(side === value ? null : value)}>
      <span className="net-tile-label">
        {label}
        <Glyph name={icon} size={18} />
      </span>
      <span className="num net-tile-amount" data-testid={`net-${value}`}>
        {whole(amount)}
      </span>
    </button>
  );
  return (
    <section className="card net-strip" aria-label="Net position">
      <div className="net-words">
        <span className="net-label">{netLabel(summary)}</span>
        <span className="num net-amount" data-testid="net-amount">
          {whole(Math.abs(summary.netMinor))}
        </span>
      </div>
      <div className="net-tiles">
        {tile('owed_to_me', 'Owed to you', 'arrow-bottom-left', summary.owedToMeMinor)}
        {tile('i_owe', 'You owe', 'arrow-top-right', summary.iOweMinor)}
      </div>
    </section>
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
  open,
  summary,
  side,
  selectedId,
  today,
  onPick,
  onClearSide,
}: {
  open: readonly DebtLine[];
  summary: DebtsData['summary'];
  side: Side | null;
  selectedId: string | null;
  today: string;
  onPick: (id: string) => void;
  onClearSide: () => void;
}) {
  const owed = open.filter((line) => line.debt.direction === 'owed_to_me').reduce((sum, line) => sum + line.balanceMinor, 0);
  const owe = open.filter((line) => line.debt.direction === 'i_owe').reduce((sum, line) => sum + line.balanceMinor, 0);
  return (
    <section className="card people-card" aria-label="People">
      <div className="card-head">
        <h2 className="card-title people-title">
          People
          {side && (
            <button type="button" className="chip filter-chip press" onClick={onClearSide}>
              {side === 'owed_to_me' ? 'Owed to you' : 'You owe'}
              <Glyph name="close" size={16} />
            </button>
          )}
        </h2>
        <span className="hint-keys">
          <span className="kbd">J</span>
          <span className="kbd">K</span>
          move · <span className="kbd">R</span>record a repayment
        </span>
      </div>
      {summary.open.length === 0 ? (
        <div className="dashed-tile all-settled">
          <Cat mood="happy" size={44} id="all-settled" />
          <span>
            <b>Nobody owes anybody</b>
            <br />
            Every debt is paid back. They stay under Settled.
          </span>
        </div>
      ) : (
        <div role="grid" aria-label="Open debts by person">
          <div className="grid-head people-row" role="row" data-only="sidebar rail rail-one-column">
            <span role="columnheader" className="caps">
              Person
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
          {open.map((line) => (
            <PersonRow key={line.debt.id} line={line} today={today} selected={selectedId === line.debt.id} onPick={onPick} />
          ))}
          {open.length === 0 && <p className="meta nobody">Nobody here right now.</p>}
          <div className="grid-total people-row" role="row" data-testid="people-total">
            <b className="open-label">{openLabel(open)}</b>
            <span data-col="due" />
            <span className="num tone-in" data-col="owes-you">
              {formatMoney(owed, summary.currency)}
            </span>
            <span className="num" data-col="you-owe">
              {formatMoney(owe, summary.currency)}
            </span>
            <span />
          </div>
        </div>
      )}
    </section>
  );
}

