'use client';

import { billDueFrom, billSeriesKey, currencySymbol, merchantName, planAddBill, seriesKey, type FinanceTransaction, type NewBill, type RecurringOverrideRow } from '@repo/core';
import { minorToDecimal } from '@repo/types';
import { useState } from 'react';
import { DateField } from '@/components/controls/date-picker';
import { Icon } from '@/components/icon';
import { parseAmountDraft } from '@/lib/budget-view';
import { commit, planContext } from '@/lib/ledger/commit';
import type { Ledger } from '@/lib/ledger/use-ledger';
import { moniStore } from '@/lib/moni-store';
import '@/components/ledger/table-pane.css';

const OFTEN = [
  { value: 'monthly', label: 'Every month' },
  { value: 'once', label: 'Just once' },
] as const;

/**
 * Make it a bill (#153, the phone's #136): New bill in the side panel, filled from the payment with its merchant,
 * amount and currency, due on its day of the month next time. It saves under the payment's own series with its
 * wallet and category, through the same plan the phone writes with.
 */
export function BillForm({ ledger, transaction, onClose }: { ledger: Ledger; transaction: FinanceTransaction; onClose: () => void }) {
  const { calendar, now, aliases, userId } = ledger;
  const today = calendar.dayKey(now);
  const currency = transaction.currency;
  const [name, setName] = useState(() => (merchantName(transaction.merchant, aliases) ?? transaction.merchant ?? '').slice(0, 30));
  const [amount, setAmount] = useState(() => minorToDecimal(transaction.amountMinor));
  const [often, setOften] = useState<'monthly' | 'once'>('monthly');
  const [due, setDue] = useState(() => billDueFrom(calendar.dayKey(transaction.transactionDate), today));

  const amountMinor = parseAmountDraft(amount);
  const named = billSeriesKey(name, currency) !== null;
  const ready = Boolean(amountMinor) && named;
  const label = !amountMinor ? 'Add an amount' : !named ? 'Name the bill' : 'Add bill';

  const save = () => {
    const key = seriesKey(transaction);
    if (!ready || !amountMinor || !key) return;
    const bill: NewBill = {
      name,
      amountMinor,
      currency,
      dueDate: due,
      once: often === 'once',
      from: { seriesKey: key, walletId: transaction.walletId, categoryId: transaction.categoryId },
    };
    const rows = Object.values((moniStore().recurringOverrides$.peek() ?? {}) as Record<string, RecurringOverrideRow | undefined>).filter(
      (row): row is RecurringOverrideRow => Boolean(row),
    );
    if (commit(planAddBill(rows, bill, planContext(userId)), `${name.trim()} added to bills`)) onClose();
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

  return (
    <div className="detail-body bill-form" role="form" aria-label="New bill" onKeyDown={keys}>
      <div className="pane-top" data-only="phone">
        <button type="button" className="icon-round icon-round-line press" aria-label="Back" onClick={onClose}>
          <Icon name="chevron-left" size={22} />
        </button>
        <span className="pane-top-title">New bill</span>
      </div>
      <h2 className="detail-name" data-only="sidebar rail rail-one-column">
        New bill
      </h2>
      <label className="bill-input">
        <span className="label-text">Name</span>
        <input value={name} maxLength={30} placeholder="e.g. Unifi fibre" autoFocus onChange={(event) => setName(event.target.value)} />
      </label>
      <label className="bill-input bill-amount">
        <span className="label-text">Amount</span>
        <b>{currencySymbol(currency)}</b>
        <input className="num" inputMode="decimal" placeholder="0.00" value={amount} aria-label={`Amount in ${currency}`} onChange={(event) => setAmount(event.target.value)} />
      </label>
      <div className="seg-tabs bill-often" role="radiogroup" aria-label="How often">
        {OFTEN.map((option) => (
          <button key={option.value} type="button" role="radio" aria-checked={often === option.value} onClick={() => setOften(option.value)}>
            {option.label}
          </button>
        ))}
      </div>
      <div className="field-row">
        <span className="label-text">Due</span>
        <DateField label="Due" className="pill-field press" min={today} today={today} value={due} onChange={setDue} />
      </div>
      <span style={{ flex: '1 1 auto' }} />
      <button type="button" className="btn btn-ink btn-lg press bill-save" disabled={!ready} onClick={save}>
        {label}
        <span className="kbd kbd-on-ink">Enter</span>
      </button>
    </div>
  );
}
