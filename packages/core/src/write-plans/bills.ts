import { billNameSchema, minorToDecimal, type CurrencyCode, type MinorAmount } from '@repo/types';

import { parseDayKey } from '../calendar';
import { merchantKey } from '../read-model/merchants';
import { planned, refused, type PlanContext, type Planned, type StoredPatch, type StoredRow } from './types';

/** A bill verdict as stored, soft-deleted rows included, so a series made a bill again revives its row. */
export type RecurringOverrideRow = StoredRow<'recurring_overrides'>;

/** The payment a bill is made from (#136): its series, wallet and category. */
export type BillSource = { seriesKey: string; walletId: string; categoryId: string | null };

export type NewBill = {
  name: string;
  amountMinor: MinorAmount;
  currency: CurrencyCode;
  /** Local `YYYY-MM-DD`. */
  dueDate: string;
  once: boolean;
  from?: BillSource;
};

const NOT_MIGRATED = 'Moni needs a server update before it can save this. Try again later.';

/** The series key a new bill groups its payments under, or null for a name with no letters. */
export function billSeriesKey(name: string, currency: CurrencyCode): string | null {
  const merchant = merchantKey(name);
  return merchant ? `${currency}|expense|${merchant}` : null;
}

/**
 * "Add a bill": a confirmed bill, due monthly or once. Made from a payment, it joins that payment's
 * series with its wallet and category, so the payment and later ones from the merchant count against
 * it. The series' own row is reused, live or forgotten, so a series never holds two verdicts.
 */
export function planAddBill(
  rows: readonly RecurringOverrideRow[],
  bill: NewBill,
  ctx: PlanContext,
): Planned<{ seriesKey: string }> {
  if (!ctx.isMigrated('recurring_override_bills')) return refused(NOT_MIGRATED);
  const name = billNameSchema.safeParse(bill.name);
  if (!name.success) return refused(bill.name.trim() ? 'That name is too long.' : 'Name the bill first.');
  if (bill.amountMinor <= 0) return refused('Add an amount first.');
  if (!parseDayKey(bill.dueDate)) return refused('Pick a due date first.');
  const seriesKey = bill.from?.seriesKey ?? billSeriesKey(name.data, bill.currency);
  if (!seriesKey) return refused('A bill name needs a letter in it.');

  const fields = {
    status: 'confirmed',
    kind: 'bill',
    currency: bill.currency,
    expected_amount: minorToDecimal(bill.amountMinor),
    expected_day: Number(bill.dueDate.slice(8, 10)),
    name: name.data,
    due_once: bill.once ? bill.dueDate : null,
    skip_period: null,
    ...(bill.from ? { wallet_id: bill.from.walletId, category_id: bill.from.categoryId } : {}),
  } satisfies StoredPatch<'recurring_overrides'>;

  const mine = rows
    .filter((row) => row.user_id === ctx.userId && row.series_key === seriesKey)
    .sort((a, b) => Number(Boolean(a.deleted)) - Number(Boolean(b.deleted)) || String(b.updated_at ?? '').localeCompare(String(a.updated_at ?? '')));
  const own = mine[0];
  if (own && !own.deleted) {
    return planned({ patch: [{ table: 'recurring_overrides', id: own.id, patch: { ...fields, updated_at: ctx.now } }] }, { seriesKey });
  }
  return planned(
    {
      insert: [
        {
          table: 'recurring_overrides',
          row: own
            ? { ...own, ...fields, deleted: false, updated_at: ctx.now }
            : { id: ctx.newId(), user_id: ctx.userId, series_key: seriesKey, ...fields, deleted: false },
        },
      ],
    },
    { seriesKey },
  );
}
