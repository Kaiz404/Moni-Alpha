import { randomUUID } from 'expo-crypto';
import {
  billNameSchema,
  decimalToMinor,
  minorToDecimal,
  setRecurringOverrideInputSchema,
  type CurrencyCode,
  type MinorAmount,
  type RecurringOverride,
  type SetRecurringOverrideInput,
} from '@repo/types';
import { merchantKey } from '@/lib/ai/routine';
import { assertMigrated, recurringOverrides$ } from '@/lib/store';
import { getRecordValues, patchRow } from '@/lib/store/helpers';
import { getUserId } from '@/lib/supabase/client';

export type RecurringOverrideRow = {
  id: string;
  user_id: string | null;
  series_key: string | null;
  status: string | null;
  kind: string | null;
  expected_amount: string | number | null;
  expected_day: number | null;
  currency: string | null;
  skip_period?: string | null;
  remind?: boolean | null;
  name?: string | null;
  wallet_id?: string | null;
  category_id?: string | null;
  due_once?: string | null;
  created_at: string | null;
  updated_at: string | null;
  deleted?: boolean;
};

function rowToOverride(row: RecurringOverrideRow): RecurringOverride {
  return {
    id: row.id,
    userId: row.user_id ?? '',
    seriesKey: row.series_key ?? '',
    status: row.status === 'dismissed' ? 'dismissed' : 'confirmed',
    kind:
      row.kind === 'income' || row.kind === 'bill' || row.kind === 'subscription' ? row.kind : null,
    expectedAmountMinor: row.expected_amount === null ? null : decimalToMinor(row.expected_amount),
    expectedDay: row.expected_day ?? null,
    currency: (row.currency ?? '').toUpperCase(),
    skipPeriod: row.skip_period ?? null,
    remind: row.remind === true,
    name: row.name ?? null,
    walletId: row.wallet_id ?? null,
    categoryId: row.category_id ?? null,
    dueOnce: row.due_once ?? null,
    createdAt: row.created_at ?? '',
    updatedAt: row.updated_at ?? row.created_at ?? '',
  };
}

/** One verdict per series: offline devices can each write one, so the latest update wins. */
export function selectRecurringOverrides(
  rows: readonly RecurringOverrideRow[],
  userId: string,
): RecurringOverride[] {
  const latest = new Map<string, RecurringOverride>();
  for (const row of rows) {
    if (row.user_id !== userId || !row.series_key || row.deleted) continue;
    const override = rowToOverride(row);
    const current = latest.get(override.seriesKey);
    if (!current || override.updatedAt > current.updatedAt)
      latest.set(override.seriesKey, override);
  }
  return [...latest.values()];
}

/** The user's live verdicts; the recurring detector reads these. */
export function listRecurringOverrides(userId: string): RecurringOverride[] {
  return selectRecurringOverrides(
    getRecordValues<RecurringOverrideRow>(recurringOverrides$),
    userId,
  );
}

/** Columns from the bills migration; writing one before it runs would stall the table's sync. */
type BillFields = Pick<
  SetRecurringOverrideInput,
  'skipPeriod' | 'remind' | 'name' | 'walletId' | 'categoryId' | 'dueOnce'
>;

function billColumns(data: BillFields): Partial<RecurringOverrideRow> {
  const columns: Partial<RecurringOverrideRow> = {};
  if (data.skipPeriod !== undefined) columns.skip_period = data.skipPeriod;
  if (data.remind !== undefined) columns.remind = data.remind;
  if (data.name !== undefined) columns.name = data.name;
  if (data.walletId !== undefined) columns.wallet_id = data.walletId;
  if (data.categoryId !== undefined) columns.category_id = data.categoryId;
  if (data.dueOnce !== undefined) columns.due_once = data.dueOnce;
  if (Object.keys(columns).length) assertMigrated('recurring_override_bills');
  return columns;
}

function ownRow(userId: string, seriesKey: string): RecurringOverrideRow | undefined {
  return Object.values(
    (recurringOverrides$.peek() ?? {}) as Record<string, RecurringOverrideRow | undefined>,
  ).find((row) => row?.user_id === userId && row.series_key === seriesKey);
}

/** Confirm or dismiss a series, reusing its row (revived if it was cleared) when this device has one. */
export async function setRecurringOverride(input: SetRecurringOverrideInput): Promise<void> {
  const userId = await getUserId();
  if (!userId) throw new Error('Not authenticated');
  const data = setRecurringOverrideInputSchema.parse(input);
  const fields = {
    status: data.status,
    kind: data.kind ?? null,
    expected_amount:
      data.expectedAmountMinor == null ? null : minorToDecimal(data.expectedAmountMinor),
    expected_day: data.expectedDay ?? null,
    currency: data.currency,
    ...billColumns(data),
  };

  const existing = ownRow(userId, data.seriesKey);
  if (existing) {
    recurringOverrides$[existing.id].set({
      ...existing,
      ...fields,
      deleted: false,
      updated_at: new Date().toISOString(),
    });
    return;
  }

  const id = randomUUID();
  recurringOverrides$[id].set({
    id,
    user_id: userId,
    series_key: data.seriesKey,
    ...fields,
    deleted: false,
  });
}

/** What the bill page edits; anything left out stays as it is. */
export type BillPatch = BillFields & {
  expectedAmountMinor?: MinorAmount;
  expectedDay?: number;
  status?: 'confirmed' | 'dismissed';
};

/**
 * Change a bill in place. A detected series with no verdict yet becomes a confirmed bill
 * holding its current amount and day, so later edits have a row to land on.
 */
export async function updateBill(
  bill: { seriesKey: string; currency: string; amountMinor: MinorAmount; dueDate: string },
  patch: BillPatch,
): Promise<void> {
  const userId = await getUserId();
  if (!userId) throw new Error('Not authenticated');
  const existing = ownRow(userId, bill.seriesKey);
  if (existing && !existing.deleted) {
    const columns = billColumns(patch);
    recurringOverrides$[existing.id].set({
      ...existing,
      ...columns,
      ...(patch.status ? { status: patch.status } : {}),
      ...(patch.expectedAmountMinor !== undefined
        ? { expected_amount: minorToDecimal(patch.expectedAmountMinor) }
        : {}),
      ...(patch.expectedDay !== undefined ? { expected_day: patch.expectedDay } : {}),
      updated_at: new Date().toISOString(),
    });
    return;
  }
  await setRecurringOverride({
    seriesKey: bill.seriesKey,
    status: patch.status ?? 'confirmed',
    currency: bill.currency,
    kind: 'bill',
    expectedAmountMinor: patch.expectedAmountMinor ?? bill.amountMinor,
    expectedDay: patch.expectedDay ?? Number(bill.dueDate.slice(8, 10)),
    ...patch,
  });
}

/** Skip a bill for one month (`YYYY-MM`); its verdict stays as it was. */
export async function skipBill(
  bill: { seriesKey: string; currency: string; amountMinor: MinorAmount; dueDate: string },
  period: string | null,
): Promise<void> {
  await updateBill(bill, { skipPeriod: period });
}

/** The series key a new bill groups its payments under, or null for a name with no letters. */
export function billSeriesKey(name: string, currency: CurrencyCode): string | null {
  const merchant = merchantKey(name);
  return merchant ? `${currency}|expense|${merchant}` : null;
}

/** "Add a bill": a confirmed bill with no payment history yet, due monthly or once. */
export async function addBill(input: {
  name: string;
  amountMinor: MinorAmount;
  currency: CurrencyCode;
  /** Local `YYYY-MM-DD`. */
  dueDate: string;
  once: boolean;
}): Promise<string> {
  const name = billNameSchema.parse(input.name);
  const seriesKey = billSeriesKey(name, input.currency);
  if (!seriesKey) throw new Error('A bill name needs a letter in it.');
  await setRecurringOverride({
    seriesKey,
    status: 'confirmed',
    kind: 'bill',
    currency: input.currency,
    expectedAmountMinor: input.amountMinor,
    expectedDay: Number(input.dueDate.slice(8, 10)),
    name,
    dueOnce: input.once ? input.dueDate : null,
    skipPeriod: null,
  });
  return seriesKey;
}

/** Forget the verdict, so the detector decides on its own again. */
export function clearRecurringOverride(id: string): void {
  patchRow(recurringOverrides$, id, { deleted: true, updated_at: new Date().toISOString() });
}
