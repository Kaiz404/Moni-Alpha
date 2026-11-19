import {
  planTransaction,
  planTransfer,
  refused,
  type Calendar,
  type DayKey,
  type LedgerView,
  type PlanContext,
  type Planned,
  type ReadDraft,
} from '@repo/core';
import { createTransactionSchema, decimalToMinor, type MinorAmount } from '@repo/types';

/**
 * Add a transaction on the web (#93): the chooser, then Type it (the phone's manual page) or Ask Moni
 * (a sentence Moni reads into a Type it form for the user to check). The phone's + offers the same two
 * among its four.
 */
export type AddMode = 'choose' | 'type' | 'ask';

export type AddKind = 'expense' | 'income' | 'transfer';

export type AddForm = {
  kind: AddKind;
  /** As typed: "12.50", "1,200". */
  amount: string;
  walletId: string | null;
  toWalletId: string | null;
  categoryId: string | null;
  /** The day it happened; null is today. */
  day: DayKey | null;
  /** The exact time Moni read, kept while the day stays the one Moni picked. */
  at: string | null;
  location: string;
  /** Shop or note: the merchant of an expense or income, the description of a transfer. */
  note: string;
  /** Why Moni filled the fields as it did; null for a form the user typed. */
  evidence: string | null;
};

export const EMPTY_ADD_FORM: AddForm = {
  kind: 'expense',
  amount: '',
  walletId: null,
  toWalletId: null,
  categoryId: null,
  day: null,
  at: null,
  location: '',
  note: '',
  evidence: null,
};

export const ADD_COPY: Record<AddKind, { tab: string; save: string; wallet: string; added: string }> = {
  expense: { tab: 'Expense', save: 'Add expense', wallet: 'Paid with', added: 'Expense added' },
  income: { tab: 'Income', save: 'Add income', wallet: 'Paid into', added: 'Income added' },
  transfer: { tab: 'Transfer', save: 'Add transfer', wallet: 'From', added: 'Transfer added' },
};

/** The typed amount in minor units, or null while it is empty, unreadable or not above zero. */
export function readAmount(text: string): MinorAmount | null {
  try {
    const minor = decimalToMinor(text.replaceAll(',', '').trim());
    return minor > 0 ? minor : null;
  } catch {
    return null;
  }
}

/** Moni's read of a sentence as the Type it form, for the user to check before Add. */
export function formFromDraft(draft: ReadDraft, calendar: Calendar): AddForm {
  return {
    kind: draft.kind,
    amount: (Number(draft.amountMinor) / 100).toFixed(2),
    walletId: draft.walletId,
    toWalletId: null,
    categoryId: draft.categoryId,
    day: calendar.dayKey(draft.transactionDate),
    at: draft.transactionDate,
    location: '',
    note: draft.merchant,
    evidence: draft.evidence,
  };
}

/** When it happened: Moni's own time on Moni's day, now for today, else the start of the day. */
export function addedAt(form: Pick<AddForm, 'day' | 'at'>, calendar: Calendar, now: Date): string {
  if (form.at && form.day === calendar.dayKey(form.at)) return form.at;
  if (!form.day || form.day === calendar.dayKey(now)) return now.toISOString();
  return calendar.startOfDay(form.day).toISOString();
}

/** The rows Add writes. Moni's reads are sourced to Moni, typed ones to Manual. */
export function planAdd(
  form: AddForm,
  view: Pick<LedgerView, 'walletsById'>,
  calendar: Calendar,
  ctx: PlanContext,
  now: Date,
): Planned<{ id: string }> {
  const amountMinor = readAmount(form.amount);
  if (amountMinor === null) return refused('Enter an amount above zero.');
  if (!form.walletId) return { kind: 'needsInput', field: 'wallet' };
  const source = form.evidence === null ? 'manual' : 'moni';
  const transactionDate = addedAt(form, calendar, now);
  const note = form.note.trim() || null;
  if (form.kind === 'transfer') {
    return planTransfer(
      { fromWalletId: form.walletId, toWalletId: form.toWalletId ?? '', amountMinor, description: note, transactionDate },
      source,
      view,
      ctx,
    );
  }
  const parsed = createTransactionSchema.safeParse({
    walletId: form.walletId,
    amountMinor,
    type: form.kind,
    categoryId: form.categoryId,
    merchant: note,
    locationName: form.location.trim() || null,
    transactionDate,
  });
  if (!parsed.success) return refused(parsed.error.errors[0]?.message ?? 'Check this transaction.');
  return planTransaction(parsed.data, source, view, ctx);
}
