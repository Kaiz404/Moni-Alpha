'use client';

import {
  dateLabel,
  merchantName,
  planTransactionEdit,
  planTransactionsDelete,
  transactionRow,
  type FinanceTransaction,
} from '@repo/core';
import { decimalToMinor, type UpdateTransaction } from '@repo/types';
import { useEffect, useState, type ReactNode } from 'react';
import { Icon } from '@/components/icon';
import { Bubble, Glyph } from '@/components/ledger/glyph';
import { commit, planContext } from '@/lib/ledger/commit';
import { SOURCE_ICONS, SOURCE_LABELS, clockTime, rowAmount, sourceOf } from '@/lib/ledger/format';
import type { Ledger } from '@/lib/ledger/use-ledger';

type Field = 'category' | 'wallet' | 'type' | null;

/**
 * The docked detail pane (W2-Activity): J and K move, each value is a chip with its popover, merchant
 * and amount edit in place, Delete stays visible. In the phone layout it is the pushed Transaction page.
 */
export function DetailPane({
  ledger,
  transaction,
  position,
  onMove,
  onClose,
  onDeleted,
}: {
  ledger: Ledger;
  transaction: FinanceTransaction;
  position: string;
  onMove: (step: 1 | -1) => void;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const { projection, walletNames, aliases, calendar, now, userId, wallets } = ledger;
  const [open, setOpen] = useState<Field>(null);
  const [editing, setEditing] = useState<'merchant' | 'amount' | 'note' | null>(null);
  const [draft, setDraft] = useState('');
  useEffect(() => {
    setOpen(null);
    setEditing(null);
  }, [transaction.id]);

  const row = transactionRow({ ...transaction, merchant: merchantName(transaction.merchant, aliases) }, { categoriesById: projection.categoriesById, walletNames });
  const amount = rowAmount(row);
  const source = sourceOf(transaction.metadata);
  const alert = transaction.metadata.alert as { text?: string } | undefined;
  const linked = transaction.debtActivityId !== null;
  const save = (data: UpdateTransaction, done: string) => {
    setOpen(null);
    setEditing(null);
    commit(planTransactionEdit(transaction.id, data, projection, planContext(userId)), done);
  };
  const remove = () => {
    if (commit(planTransactionsDelete([transaction.id], { now: new Date().toISOString() }), `${row.title} deleted`) !== null) onDeleted();
  };
  const categories = Object.values(projection.categoriesById)
    .filter((category) => category.isActive && (category.userId === null || category.userId === userId) && (category.type === null || category.type === transaction.type))
    .sort((a, b) => a.displayOrder - b.displayOrder || a.name.localeCompare(b.name));

  const chip = (field: Exclude<Field, null>, lead: ReactNode, text: string, options: ReactNode) => (
    <span className="picker-anchor">
      <button type="button" className="field-chip press" aria-haspopup="listbox" aria-expanded={open === field} disabled={linked} onClick={() => setOpen(open === field ? null : field)}>
        {lead}
        <span>{text}</span>
        <Icon name="chevron-down" size={18} />
      </button>
      {open === field && (
        <ul role="listbox" aria-label={field} className="popover motion-pop pane-pop">
          {options}
        </ul>
      )}
    </span>
  );
  const inPlace = (kind: 'merchant' | 'amount', initial: string) => {
    setDraft(initial);
    setEditing(kind);
  };
  const commitDraft = () => {
    if (editing === 'merchant' && draft.trim()) save({ merchant: draft.trim() }, 'Name saved');
    else if (editing === 'amount') {
      try {
        const minor = decimalToMinor(draft.replaceAll(',', ''));
        if (minor > 0) save({ amountMinor: minor }, 'Amount saved');
      } catch {
        // An unreadable amount keeps the field open.
      }
    } else if (editing === 'note') save({ notes: draft.trim() || null }, 'Note saved');
  };
  const editor = (label: string, className: string) => (
    <form
      className={`in-place ${className}`}
      onSubmit={(event) => {
        event.preventDefault();
        commitDraft();
      }}
    >
      <input aria-label={label} autoFocus value={draft} inputMode={editing === 'amount' ? 'decimal' : undefined} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => event.key === 'Escape' && (event.stopPropagation(), setEditing(null))} />
      <button type="button" className="icon-round press" aria-label="Cancel" onClick={() => setEditing(null)}>
        <Icon name="close" size={18} />
      </button>
      <button type="submit" className="icon-round icon-round-ink press" aria-label="Save">
        <Icon name="check" size={18} />
      </button>
    </form>
  );

  return (
    <>
      <div className="pane-top">
        <button type="button" className="icon-round icon-round-line press" aria-label="Back" data-only="phone" onClick={onClose}>
          <Icon name="chevron-left" size={22} />
        </button>
        <span className="pane-top-title" data-only="phone">
          Transaction
        </span>
        <span data-only="sidebar rail rail-one-column" className="pane-nav">
          <button type="button" className="icon-round icon-round-line press" aria-label="Previous transaction (K)" onClick={() => onMove(-1)}>
            <Glyph name="chevron-up" size={20} />
          </button>
          <button type="button" className="icon-round icon-round-line press" aria-label="Next transaction (J)" onClick={() => onMove(1)}>
            <Icon name="chevron-down" size={20} />
          </button>
          <span className="meta num pane-position">{position}</span>
          <span className="key-hint">
            <span className="kbd">J</span>
            <span className="kbd">K</span>
          </span>
          <button type="button" className="icon-round icon-round-line press" aria-label="Close (Esc)" onClick={onClose}>
            <Icon name="close" size={20} />
          </button>
        </span>
      </div>
      <div key={transaction.id} className="pane-content rise">
        <div className="pane-title-row">
          <Bubble icon={row.icon} color={row.color} size={48} glyph={22} />
          <div className="pane-titles">
            {editing === 'merchant' ? (
              editor('Merchant name', 'in-place-name')
            ) : (
              <span className="pane-name-line">
                <span className="pane-name" onClick={() => !linked && inPlace('merchant', row.title)}>
                  {row.title}
                </span>
                {!linked && (
                  <button type="button" className="pencil press" aria-label="Edit merchant name" onClick={() => inPlace('merchant', row.title)}>
                    <Glyph name="pencil-outline" size={16} />
                  </button>
                )}
              </span>
            )}
            <span className="meta">
              {dateLabel(calendar.dayKey(transaction.transactionDate), calendar.dayKey(now))} · {clockTime(transaction.transactionDate, calendar.zone)}
              {transaction.merchant && row.title !== transaction.merchant ? ` · Alert says ${transaction.merchant}` : ''}
            </span>
          </div>
        </div>
        {editing === 'amount' ? (
          editor('Amount', 'in-place-amount')
        ) : (
          <div className="pane-amount-row">
            <span className="pane-amount num" data-tone={amount.tone}>
              {amount.text}
            </span>
            {!linked && (
              <button type="button" className="pencil press" aria-label="Edit amount" onClick={() => inPlace('amount', (Number(transaction.amountMinor) / 100).toFixed(2))}>
                <Glyph name="pencil-outline" size={16} />
              </button>
            )}
          </div>
        )}
        <dl className="pane-fields">
          {transaction.type !== 'transfer' && (
            <div className="pane-field">
              <dt>Category</dt>
              <dd>
                {chip(
                  'category',
                  <Bubble icon={row.icon} color={row.color} size={26} glyph={15} />,
                  row.category ?? 'Pick a category',
                  categories.map((category) => (
                    <li key={category.id} role="option" aria-selected={category.id === transaction.categoryId} tabIndex={0} className="popover-row" onClick={() => save({ categoryId: category.id }, `Moved to ${category.name}`)}>
                      <Bubble icon={category.icon} color={category.color} size={26} glyph={14} />
                      {category.name}
                    </li>
                  )),
                )}
              </dd>
            </div>
          )}
          <div className="pane-field">
            <dt>Wallet</dt>
            <dd>
              {chip(
                'wallet',
                <Bubble icon={projection.walletsById[transaction.walletId]?.icon} color={projection.walletsById[transaction.walletId]?.color} size={26} glyph={15} />,
                row.kind === 'transfer' ? `${row.wallet} → ${row.toWallet}` : row.wallet,
                wallets
                  .filter((wallet) => wallet.currency === transaction.currency)
                  .map((wallet) => (
                    <li key={wallet.id} role="option" aria-selected={wallet.id === transaction.walletId} tabIndex={0} className="popover-row" onClick={() => save({ walletId: wallet.id }, `Moved to ${walletNames[wallet.id] ?? wallet.name}`)}>
                      <Bubble icon={wallet.icon} color={wallet.color} size={26} glyph={14} />
                      {wallet.name}
                    </li>
                  )),
              )}
            </dd>
          </div>
          {transaction.type !== 'transfer' && (
            <div className="pane-field">
              <dt>Type</dt>
              <dd>
                {chip(
                  'type',
                  <span className="mini-bubble">
                    <Glyph name="swap-vertical" size={15} />
                  </span>,
                  transaction.type === 'income' ? 'Income' : 'Expense',
                  (['expense', 'income'] as const).map((type) => (
                    <li key={type} role="option" aria-selected={type === transaction.type} tabIndex={0} className="popover-row" onClick={() => save({ type, categoryId: null }, type === 'income' ? 'Now income' : 'Now an expense')}>
                      {type === 'income' ? 'Income' : 'Expense'}
                    </li>
                  )),
                )}
              </dd>
            </div>
          )}
          <div className="pane-field">
            <dt>Date</dt>
            <dd>
              <label className="field-chip field-chip-date press">
                <span className="mini-bubble">
                  <Glyph name="calendar-blank-outline" size={15} />
                </span>
                <span>
                  {dateLabel(calendar.dayKey(transaction.transactionDate), calendar.dayKey(now))} · {clockTime(transaction.transactionDate, calendar.zone)}
                </span>
                <input
                  type="date"
                  aria-label="Date"
                  disabled={linked}
                  value={calendar.dayKey(transaction.transactionDate)}
                  onChange={(event) => {
                    if (!event.target.value) return;
                    const at = new Date(transaction.transactionDate);
                    const shift = calendar.startOfDay(event.target.value).getTime() - calendar.startOfDay(calendar.dayKey(at)).getTime();
                    save({ transactionDate: new Date(at.getTime() + shift).toISOString() }, 'Date saved');
                  }}
                />
              </label>
            </dd>
          </div>
          <div className="pane-field">
            <dt>Place</dt>
            <dd className="field-static">
              <span className="mini-bubble">
                <Glyph name="map-marker-outline" size={15} />
              </span>
              {transaction.locationName ?? 'No place'}
            </dd>
          </div>
          <div className="pane-field">
            <dt>Source</dt>
            <dd className="field-static">
              <span className="mini-bubble">
                <Glyph name={SOURCE_ICONS[source]} size={15} />
              </span>
              {SOURCE_LABELS[source]}
            </dd>
          </div>
        </dl>
        {alert?.text && (
          <figure className="pane-alert">
            <figcaption className="caps">{source === 'notification' ? 'Bank alert' : 'Moni read'}</figcaption>
            <blockquote>&ldquo;{alert.text}&rdquo;</blockquote>
          </figure>
        )}
        {editing === 'note' ? (
          editor('Note', 'in-place-note')
        ) : (
          <button type="button" className="pane-note press" onClick={() => (setDraft(transaction.notes ?? ''), setEditing('note'))}>
            <Glyph name="note-text-outline" size={20} />
            {transaction.notes ?? 'Add a note'}
          </button>
        )}
        <span className="grow-space" />
        {linked ? (
          <p className="meta">This row belongs to a debt. Change it on Debts.</p>
        ) : (
          <button type="button" className="btn delete-btn press" onClick={remove}>
            <Icon name="delete-outline" size={20} />
            Delete transaction
            <span className="kbd" data-only="sidebar rail rail-one-column">
              Del
            </span>
          </button>
        )}
      </div>
    </>
  );
}
