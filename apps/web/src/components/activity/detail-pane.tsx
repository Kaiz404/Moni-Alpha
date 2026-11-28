'use client';

import {
  dateLabel,
  merchantName,
  planTransactionEdit,
  transactionRow,
  type FinanceTransaction,
  type PaymentBill,
} from '@repo/core';
import { decimalToMinor, type UpdateTransaction } from '@repo/types';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { NewCategoryDialog, newCategoryAction } from '@/components/categories/new-category';
import { DateField } from '@/components/controls/date-picker';
import { Select } from '@/components/controls/select';
import { Icon } from '@/components/icon';
import { FromTo } from '@/components/ledger/from-to';
import { Bubble, Glyph } from '@/components/ledger/glyph';
import { ReceiptRow } from '@/components/receipt/receipt-row';
import { categoryChoices, suggestedCategories } from '@/lib/category-pick';
import { commit, planContext } from '@/lib/ledger/commit';
import { SOURCE_ICONS, SOURCE_LABELS, clockTime, rowAmount, sourceOf } from '@/lib/ledger/format';
import type { Ledger } from '@/lib/ledger/use-ledger';

/**
 * A transaction in the side panel (W2-Activity, #106): J and K move, each value is a chip with its popover, merchant
 * and amount edit in place, Delete is the trash at the top right. In the phone layout it is the pushed Transaction page.
 */
export function DetailPane({
  ledger,
  transaction,
  bill,
  onClose,
  onDelete,
  onMakeBill,
}: {
  ledger: Ledger;
  transaction: FinanceTransaction;
  /** Whether it is one of the bills, or could become one (#153). */
  bill: PaymentBill | null;
  onClose: () => void;
  /** Asks to confirm, then deletes (W2-Parts). */
  onDelete: () => void;
  onMakeBill: () => void;
}) {
  const { projection, walletNames, aliases, calendar, now, userId, wallets } = ledger;
  const [editing, setEditing] = useState<'merchant' | 'amount' | 'note' | null>(null);
  const [draft, setDraft] = useState('');
  const [creating, setCreating] = useState(false);
  useEffect(() => {
    setEditing(null);
    setCreating(false);
  }, [transaction.id]);

  const row = transactionRow({ ...transaction, merchant: merchantName(transaction.merchant, aliases) }, { categoriesById: projection.categoriesById, walletNames });
  const amount = rowAmount(row);
  const source = sourceOf(transaction.metadata);
  const alert = transaction.metadata.alert as { text?: string } | undefined;
  const linked = transaction.debtActivityId !== null;
  // The change's toast says it saved, with Undo, in the one bottom-left slot (#103); the field shows no note of its own.
  const save = (data: UpdateTransaction, done: string) => {
    setEditing(null);
    commit(planTransactionEdit(transaction.id, data, projection, planContext(userId)), done);
  };
  const kind = transaction.type === 'income' ? 'income' : 'expense';
  const categories = categoryChoices(ledger, kind);
  const suggested = transaction.categoryId
    ? []
    : suggestedCategories(ledger, { type: transaction.type, merchant: transaction.merchant, text: transaction.description, sourceApp: null, categoryHint: null });

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
      <div className="pane-top" data-only="phone">
        <button type="button" className="icon-round icon-round-line press" aria-label="Back" data-only="phone" onClick={onClose}>
          <Icon name="chevron-left" size={22} />
        </button>
        <span className="pane-top-title" data-only="phone">
          Transaction
        </span>
        {linked ? null : (
          <button type="button" className="icon-round icon-round-line press" aria-label="Delete transaction" data-only="phone" onClick={onDelete}>
            <Icon name="delete-outline" size={22} />
          </button>
        )}
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
              {dateLabel(calendar.dayKey(transaction.transactionDate), calendar.dayKey(now))} at {clockTime(transaction.transactionDate, calendar.zone)}
              {transaction.merchant && row.title !== transaction.merchant ? `, alert says ${transaction.merchant}` : ''}
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
                <Select
                  label="Category"
                  className="field-chip press"
                  disabled={linked}
                  value={transaction.categoryId}
                  text={row.category ?? 'Pick a category'}
                  lead={<Bubble icon={row.icon} color={row.color} size={26} glyph={15} />}
                  listClassName="pane-pop"
                  options={categories.map((category) => ({ value: category.id, label: category.name, lead: <Bubble icon={category.icon} color={category.color} size={26} glyph={14} /> }))}
                  suggested={{ values: suggested, allLabel: 'All categories' }}
                  action={newCategoryAction(() => setCreating(true))}
                  onChange={(id) => save({ categoryId: id }, `Moved to ${projection.categoriesById[id]?.name ?? 'that category'}`)}
                />
                {creating && (
                  <NewCategoryDialog
                    ledger={ledger}
                    type={kind}
                    onClose={(made) => {
                      setCreating(false);
                      if (made) save({ categoryId: made.id }, `Moved to ${made.name}`);
                    }}
                  />
                )}
              </dd>
            </div>
          )}
          <div className="pane-field">
            <dt>Wallet</dt>
            <dd>
              <Select
                label="Wallet"
                className="field-chip press"
                disabled={linked}
                value={transaction.walletId}
                listClassName="pane-pop"
                text={row.kind === 'transfer' ? <FromTo from={row.wallet} to={row.toWallet} /> : row.wallet}
                triggerLabel={row.kind === 'transfer' ? `Wallet: ${row.wallet} to ${row.toWallet}` : undefined}
                options={wallets
                  .filter((wallet) => wallet.currency === transaction.currency)
                  .map((wallet) => ({
                    value: wallet.id,
                    label: wallet.name,
                    lead: <Bubble icon={wallet.icon} color={wallet.color} size={26} glyph={14} />,
                  }))}
                onChange={(id) => save({ walletId: id }, `Moved to ${walletNames[id] ?? 'that wallet'}`)}
              />
            </dd>
          </div>
          {transaction.type !== 'transfer' && (
            <div className="pane-field">
              <dt>Type</dt>
              <dd>
                <Select
                  label="Type"
                  className="field-chip press"
                  disabled={linked}
                  value={transaction.type}
                  lead={
                    <span className="mini-bubble">
                      <Glyph name="swap-vertical" size={15} />
                    </span>
                  }
                  options={[
                    { value: 'expense', label: 'Expense' },
                    { value: 'income', label: 'Income' },
                  ]}
                  onChange={(type) => save({ type, categoryId: null }, type === 'income' ? 'Now income' : 'Now an expense')}
                />
              </dd>
            </div>
          )}
          <div className="pane-field">
            <dt>Date</dt>
            <dd>
              <DateField
                label="Date"
                className="field-chip press"
                disabled={linked}
                value={calendar.dayKey(transaction.transactionDate)}
                today={calendar.dayKey(now)}
                lead={
                  <span className="mini-bubble">
                    <Glyph name="calendar-blank-outline" size={15} />
                  </span>
                }
                onChange={(day) => {
                  const at = new Date(transaction.transactionDate);
                  const shift = calendar.startOfDay(day).getTime() - calendar.startOfDay(calendar.dayKey(at)).getTime();
                  save({ transactionDate: new Date(at.getTime() + shift).toISOString() }, 'Date saved');
                }}
              />
            </dd>
          </div>
          <div className="pane-field">
            <dt>Place</dt>
            <dd className="field-chip field-static">
              <span className="mini-bubble">
                <Glyph name="map-marker-outline" size={15} />
              </span>
              <span className="select-value">{transaction.locationName ?? 'No place'}</span>
            </dd>
          </div>
          <div className="pane-field">
            <dt>Source</dt>
            <dd className="field-chip field-static">
              <span className="mini-bubble">
                <Glyph name={SOURCE_ICONS[source]} size={15} />
              </span>
              <span className="select-value">{SOURCE_LABELS[source]}</span>
            </dd>
          </div>
        </dl>
        {alert?.text && (
          <figure className="pane-alert">
            <figcaption className="caps">{source === 'notification' ? 'Bank alert' : 'Moni read'}</figcaption>
            <blockquote>&ldquo;{alert.text}&rdquo;</blockquote>
          </figure>
        )}
        <ReceiptRow stored={transaction.receiptImageUrl} name={row.title} />
        {bill?.kind === 'bill' ? (
          <Link href="/budget" className="pane-note pane-bill press">
            <Glyph name="repeat" size={20} />
            {bill.once ? 'One-time bill' : 'Monthly bill'}
            <Glyph name="chevron-right" size={18} />
          </Link>
        ) : bill && !linked ? (
          <button type="button" className="pane-note pane-bill press" onClick={onMakeBill}>
            <Glyph name="repeat" size={20} />
            Make it a bill
            <Glyph name="chevron-right" size={18} />
          </button>
        ) : null}
        {editing === 'note' ? (
          editor('Note', 'in-place-note')
        ) : (
          <button type="button" className="pane-note press" onClick={() => (setDraft(transaction.notes ?? ''), setEditing('note'))}>
            <Glyph name="note-text-outline" size={20} />
            {transaction.notes ?? 'Add a note'}
          </button>
        )}
        {linked && <p className="meta pane-linked">This row belongs to a debt. Change it on Debts.</p>}
      </div>
    </>
  );
}
