import { randomUUID } from 'expo-crypto';
import {
  minorToDecimal,
  setRecurringOverrideInputSchema,
  type MinorAmount,
  type RecurringOverride,
  type SetRecurringOverrideInput,
} from '@repo/types';
import {
  planAddBill,
  recurringOverridesFromRows,
  type NewBill,
  type RecurringOverrideRow,
} from '@repo/core';
import { assertMigrated, recurringOverrides$ } from '@/lib/store';
import { patchRow } from '@/lib/store/helpers';
import { commit, planContext } from '@/lib/store/writes';
import { getUserId } from '@/lib/supabase/client';

/** The user's live verdicts; the recurring detector reads these. */
export function listRecurringOverrides(userId: string): RecurringOverride[] {
  return recurringOverridesFromRows(recurringOverrides$.get() ?? {}, userId);
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

/** "Add a bill", shared with the web: see `planAddBill`. */
export async function addBill(bill: NewBill): Promise<string> {
  const rows = Object.values(
    (recurringOverrides$.peek() ?? {}) as Record<string, RecurringOverrideRow | undefined>,
  ).filter((row): row is RecurringOverrideRow => Boolean(row));
  return commit(planAddBill(rows, bill, await planContext())).seriesKey;
}

/** Forget the verdict, so the detector decides on its own again. */
export function clearRecurringOverride(id: string): void {
  patchRow(recurringOverrides$, id, { deleted: true, updated_at: new Date().toISOString() });
}
