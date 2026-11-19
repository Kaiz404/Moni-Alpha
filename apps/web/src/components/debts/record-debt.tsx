'use client';

import { formatMoney, type NewDebt } from '@repo/core';
import { parseAmountDraft } from '@/lib/budget-view';
import { DateField } from '@/components/controls/date-picker';
import { Select } from '@/components/controls/select';
import { Glyph, PersonTile } from '@/components/ledger/glyph';
import type { DebtsData } from './use-debts';

/** Record a debt as it is being typed; it lives with the screen so a resize or a section switch keeps it. */
export type DebtDraft = {
  direction: 'owed_to_me' | 'i_owe';
  name: string;
  amount: string;
  walletId: string | null;
  dueDate: string;
  note: string;
};

export function RecordDebt({
  draft,
  onDraft,
  data,
  currency,
  today,
  onSave,
  onClose,
}: {
  draft: DebtDraft;
  onDraft: (draft: DebtDraft) => void;
  data: DebtsData;
  currency: string;
  today: string;
  onSave: (input: NewDebt) => void;
  onClose: () => void;
}) {
  const who = draft.name.trim();
  const amountMinor = parseAmountDraft(draft.amount);
  const owed = draft.direction === 'owed_to_me';
  const wallet = data.wallets.find((item) => item.id === draft.walletId) ?? null;
  const ready = Boolean(who && amountMinor && wallet);
  const money = (minor: number) => formatMoney(minor, wallet?.currency ?? currency);
  const existing = data.summary.open.filter(
    (line) => line.debt.direction === draft.direction && line.debt.counterpartyName.trim().toLocaleLowerCase() === who.toLocaleLowerCase(),
  );
  const existingMinor = existing.reduce((sum, line) => sum + line.balanceMinor, 0);
  const label = !ready
    ? who
      ? 'Add an amount'
      : 'Add who and an amount'
    : owed
      ? `Record: ${who} owes you ${money(amountMinor!)}`
      : `Record: you owe ${who} ${money(amountMinor!)}`;
  const save = () => {
    if (!ready || !wallet || !amountMinor) return;
    onSave({
      counterpartyName: who,
      direction: draft.direction,
      amountMinor,
      walletId: wallet.id,
      dueDate: draft.dueDate || null,
      note: draft.note.trim() || null,
    });
  };
  const keys = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && event.target instanceof HTMLInputElement) {
      event.preventDefault();
      event.stopPropagation();
      save();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      onClose();
    }
  };
  const set = (patch: Partial<DebtDraft>) => onDraft({ ...draft, ...patch });

  return (
    <div className="detail-body record-debt" role="form" aria-label="Record a debt" onKeyDown={keys}>
      <div className="detail-top">
        <button type="button" className="round-btn small phone-back" aria-label="Back" onClick={onClose}>
          <Glyph name="chevron-left" />
        </button>
        <h2 className="detail-name" style={{ flex: '1 1 auto', fontSize: 22 }}>
          Record a debt
        </h2>
        <button type="button" className="round-btn small desk-nav" onClick={onClose} aria-label="Close (Esc)">
          <Glyph name="close" />
        </button>
      </div>
      <div className="seg-tabs who-owes" role="radiogroup" aria-label="Who owes who">
        {(
          [
            ['owed_to_me', 'They owe me'],
            ['i_owe', 'I owe them'],
          ] as const
        ).map(([value, text]) => (
          <button key={value} type="button" role="radio" aria-checked={draft.direction === value} onClick={() => set({ direction: value })}>
            {text}
          </button>
        ))}
      </div>
      <label className="debt-input">
        <span className="label-text">Who</span>
        <input placeholder="Name" value={draft.name} autoFocus onChange={(event) => set({ name: event.target.value })} aria-label="Who" />
      </label>
      {data.people.length > 0 && (
        <div className="people-chips">
          {data.people.slice(0, 6).map((name) => (
            <button key={name} type="button" className="chip person-chip press" onClick={() => set({ name })}>
              <PersonTile name={name} owedToMe={owed} size={26} />
              {name}
            </button>
          ))}
        </div>
      )}
      {existing.length > 0 && (
        <span className="form-hint">
          {owed
            ? `${existing[0]!.debt.counterpartyName} already owes you ${money(existingMinor)}. This goes on ${existing[0]!.debt.counterpartyName}'s page too.`
            : `You already owe ${existing[0]!.debt.counterpartyName} ${money(existingMinor)}. This goes on ${existing[0]!.debt.counterpartyName}'s page too.`}
        </span>
      )}
      <label className="debt-input debt-amount">
        <span className="label-text">Amount</span>
        <b>RM</b>
        <input inputMode="decimal" placeholder="0.00" value={draft.amount} onChange={(event) => set({ amount: event.target.value })} aria-label="Amount, in ringgit" className="num" />
      </label>
      <div>
        <div className="field-row">
          <span className="label-text">{owed ? 'Lent from' : 'Borrowed into'}</span>
          <Select
            label={owed ? 'Lent from wallet' : 'Borrowed into wallet'}
            className="pill-field press"
            value={draft.walletId}
            placeholder="Pick a wallet"
            lead={<Glyph name="wallet-outline" size={18} />}
            options={data.wallets.map((item) => ({ value: item.id, label: item.name }))}
            onChange={(walletId) => set({ walletId })}
          />
        </div>
        <div className="field-row">
          <span className="label-text">Due date</span>
          <DateField label="Due date" className="pill-field press" today={today} value={draft.dueDate || null} onChange={(dueDate) => set({ dueDate })} onClear={() => set({ dueDate: '' })} />
        </div>
      </div>
      <label className="debt-input">
        <span className="label-text">Note</span>
        <input placeholder="Concert tickets, lunch, a trip…" value={draft.note} onChange={(event) => set({ note: event.target.value })} aria-label="Note" />
      </label>
      <span className="meta remind-note">
        <Glyph name="bell-outline" size={15} />
        Moni reminds you the day before it&apos;s due.
      </span>
      <span style={{ flex: '1 1 auto' }} />
      <button type="button" className="btn btn-ink press record-save" disabled={!ready} onClick={save}>
        {label}
        <span className="kbd kbd-on-ink">Enter</span>
      </button>
    </div>
  );
}
