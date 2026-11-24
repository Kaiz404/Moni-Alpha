'use client';

import { addDays, dateLabel, formatMoney, type DebtLine } from '@repo/core';
import type { MinorAmount } from '@repo/types';
import { parseAmountDraft } from '@/lib/budget-view';
import { NO_WALLET, repayAction, repaidWords, timeline, WALLET_WORDS, walletField } from '@/lib/debts-view';
import type { Ledger } from '@/lib/ledger/use-ledger';
import { DateField } from '@/components/controls/date-picker';
import { Select } from '@/components/controls/select';
import { Glyph, PersonTile } from '@/components/ledger/glyph';
import type { DebtsData } from './use-debts';

/** A repayment being typed in the pane: the amount, and a wallet, `NO_WALLET` when no money moved, or null until one is chosen. */
export type RepayDraft = { debtId: string; amount: string; walletId: string | null; date?: string };

function stopKeys(onEnter: () => void, onEscape: () => void) {
  return (event: React.KeyboardEvent) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      event.stopPropagation();
      onEnter();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      onEscape();
    }
  };
}

export function PersonPane({
  line,
  data,
  ledger,
  repay,
  reminded,
  onRepay,
  onRepayDraft,
  onSaveRepay,
  onRemind,
  onWriteOff,
  onRecordAgain,
  onClose,
}: {
  line: DebtLine;
  data: DebtsData;
  ledger: Ledger;
  repay: RepayDraft | null;
  reminded: boolean;
  onRepay: () => void;
  onRepayDraft: (draft: RepayDraft | null) => void;
  onSaveRepay: (line: DebtLine, amountMinor: MinorAmount, walletId: string | null, activityDate: string) => void;
  onRemind: () => void;
  onWriteOff: () => void;
  onRecordAgain: () => void;
  onClose: () => void;
}) {
  const { debt } = line;
  const mine = debt.direction === 'owed_to_me';
  const open = line.state === 'open';
  const today = ledger.calendar.dayKey(ledger.now);
  const money = (minor: number) => formatMoney(minor, debt.currency);
  const words = repaidWords(line);
  const activities = data.activitiesOf(debt.id);
  const items = timeline(line, activities, {
    today,
    dayOf: (iso) => ledger.calendar.dayKey(iso),
    walletName: (id) => (id ? (data.walletNames[id] ?? null) : null),
  });
  const walletWords = WALLET_WORDS[debt.direction];
  const principal = activities.find((activity) => activity.kind === 'principal');
  const lent = walletField(walletWords.principal, principal?.walletId ?? NO_WALLET, (id) => data.walletNames[id]);
  const paid = repay ? walletField(walletWords.repay, repay.walletId, (id) => data.walletNames[id]) : null;
  const caps = open ? (mine ? 'Owes you' : 'You owe') : line.state === 'settled' ? 'Paid in full' : 'Written off';
  const wallets = data.wallets.filter((wallet) => wallet.currency === debt.currency);

  const amountMinor = repay ? parseAmountDraft(repay.amount) : undefined;
  const capped = amountMinor !== undefined && amountMinor <= line.balanceMinor ? amountMinor : undefined;
  const save = () => {
    if (!repay || capped === undefined || !repay.walletId) return;
    const date = repay.date && repay.date !== today ? new Date(ledger.calendar.startOfDay(repay.date).getTime() + 12 * 3_600_000).toISOString() : new Date().toISOString();
    onSaveRepay(line, capped, repay.walletId, date);
  };
  const cancel = () => onRepayDraft(null);

  return (
    <div className="detail-body" key={debt.id} data-debt={debt.id}>
      <div className="detail-top" data-only="phone">
        <button type="button" className="round-btn small phone-back" aria-label="Back" onClick={onClose}>
          <Glyph name="chevron-left" />
        </button>
        <span className="count" />
        {open && (
          <button type="button" className="round-btn small pane-write-off" onClick={onWriteOff} aria-label={`Write off ${money(line.balanceMinor)}`}>
            <Glyph name="text-box-remove-outline" />
          </button>
        )}
      </div>
      <div className="detail-head">
        <PersonTile name={debt.counterpartyName} owedToMe={mine} size={52} />
        <div className="row-text">
          <h2 className="detail-name">{debt.counterpartyName}</h2>
          <span>{open ? `Since ${dateLabel(ledger.calendar.dayKey(line.startedAt), today)}` : line.state === 'settled' ? 'Settled' : 'Written off'}</span>
        </div>
      </div>
      <div className="pane-money">
        <span className="caps">{caps}</span>
        <span className={`num hero-amount person-balance${open ? '' : ' tone-quiet'}`} data-testid="person-balance">
          {money(open ? line.balanceMinor : line.principalMinor)}
        </span>
        <span className="meter" data-tone="key" style={{ height: 8 }}>
          <span style={{ width: `${line.principalMinor ? Math.round((Math.min(line.repaidMinor, line.principalMinor) / line.principalMinor) * 100) : 0}%` }} />
        </span>
        <span className="bar-words">
          <span>{words.left}</span>
          <b>{words.right}</b>
        </span>
      </div>

      {!repay && (
        <div className="pane-fields">
          {debt.note && (
            <div className="field-row">
              <span className="label-text">Note</span>
              <span className="pill-field">
                <Glyph name="note-text-outline" size={18} />
                <span className="pill-text">{debt.note}</span>
              </span>
            </div>
          )}
          {open && (
            <div className="field-row">
              <span className="label-text">Due date</span>
              <span className="pill-field">
                <Glyph name="calendar-blank-outline" size={18} />
                {debt.dueDate ? dateLabel(debt.dueDate, today) : 'No date'}
              </span>
            </div>
          )}
          {open && (
            <div className="field-row">
              <span className="label-text">{lent.label}</span>
              <span className="pill-field">
                <Glyph name={principal?.walletId ? 'wallet-outline' : 'note-text-outline'} size={18} />
                {lent.value ?? 'No wallet'}
              </span>
            </div>
          )}
        </div>
      )}

      <div className="detail-rule">
        <span className="caps">History</span>
        <div className="tl">
          {open && debt.dueDate && (
            <div className="tl-item">
              <span className="tl-node" data-kind="due">
                <Glyph name="calendar-clock" size={17} />
              </span>
              <span className="row-text">
                <b>Due {dateLabel(debt.dueDate, today)}</b>
                <span>Moni reminds you {dateLabel(addDays(debt.dueDate, -1), today)}</span>
              </span>
            </div>
          )}
          {items.map((item) => (
            <div key={item.id} className="tl-item" data-activity={item.kind}>
              <span className="tl-node" data-kind={item.kind}>
                <Glyph name={item.kind === 'repayment' ? 'cash-check' : item.kind === 'write_off' ? 'text-box-remove-outline' : 'hand-coin-outline'} size={17} />
              </span>
              <span className="row-text">
                <b>{item.title}</b>
                <span>{item.meta}</span>
              </span>
              <span className={`num tl-amount${item.kind === 'repayment' && mine ? ' tone-in' : ''}`}>{item.amount}</span>
            </div>
          ))}
        </div>
      </div>
      <span style={{ flex: '1 1 auto' }} />
      {open && repay && (
        <div className="repay-form" role="group" aria-label="Record a repayment">
          <div className="repay-head">
            <b>Record a repayment</b>
            <span className="num meta">{money(line.balanceMinor)} to go</span>
          </div>
          <div className="repay-amount">
            <label className="amount-field">
              <span>RM</span>
              <input
                type="text"
                inputMode="decimal"
                autoFocus
                aria-label="Amount paid back, in ringgit"
                value={repay.amount}
                onChange={(event) => onRepayDraft({ ...repay, amount: event.target.value })}
                onKeyDown={stopKeys(save, cancel)}
              />
            </label>
            <button
              type="button"
              className="chip press"
              aria-pressed={capped === line.balanceMinor}
              onClick={() => onRepayDraft({ ...repay, amount: (line.balanceMinor / 100).toFixed(2) })}
            >
              All of it
            </button>
          </div>
          {amountMinor !== undefined && amountMinor > line.balanceMinor && (
            <span className="form-note tone-over">That&apos;s more than the {money(line.balanceMinor)} still owed.</span>
          )}
          <div className="field-row">
            <span className="label-text">{paid!.label}</span>
            <Select
              label={walletWords.repay}
              className="pill-field press"
              value={repay.walletId}
              placeholder="Choose"
              text={paid!.value ?? undefined}
              triggerLabel={`${paid!.label}: ${repay.walletId === NO_WALLET ? walletWords.repayNone : (paid!.value ?? 'Choose')}`}
              lead={<Glyph name={repay.walletId === NO_WALLET ? 'note-text-outline' : 'wallet-outline'} size={18} />}
              options={[
                { value: NO_WALLET, label: walletWords.repayNone, lead: <Glyph name="note-text-outline" size={18} /> },
                ...wallets.map((wallet) => ({ value: wallet.id, label: wallet.name, lead: <Glyph name="wallet-outline" size={18} /> })),
              ]}
              onChange={(walletId) => onRepayDraft({ ...repay, walletId })}
            />
          </div>
          <div className="field-row">
            <span className="label-text">Date</span>
            <DateField label="Date paid back" className="pill-field press" max={today} today={today} value={repay.date ?? today} onChange={(date) => onRepayDraft({ ...repay, date })} />
          </div>
          <div className="repay-buttons">
            <button type="button" className="btn btn-sand press" onClick={cancel}>
              Cancel
              <span className="kbd">Esc</span>
            </button>
            <button type="button" className="btn btn-ink press" disabled={capped === undefined || !repay.walletId} onClick={save}>
              {repayAction(capped !== undefined ? money(capped) : null, repay.walletId)}
              <span className="kbd kbd-on-ink">Enter</span>
            </button>
          </div>
        </div>
      )}

      {!repay && (
        <div className="pane-foot-actions">
          {open ? (
            <>
              <button type="button" className="btn btn-ink press" onClick={onRepay}>
                Record a repayment
                <span className="kbd kbd-on-ink">R</span>
              </button>
              {mine &&
                (reminded ? (
                  <span className="reminded">
                    <Glyph name="check" size={18} />
                    Reminded today
                  </span>
                ) : (
                  <button type="button" className="btn btn-sand press" onClick={onRemind}>
                    Remind
                    <span className="kbd">M</span>
                  </button>
                ))}
            </>
          ) : (
            <button type="button" className="btn btn-sand press" onClick={onRecordAgain}>
              <Glyph name="plus" />
              Record a new debt with {debt.counterpartyName}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
