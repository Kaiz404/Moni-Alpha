import { randomUUID } from 'expo-crypto';
import {
  decimalToMinor,
  minorToDecimal,
  setRecurringOverrideInputSchema,
  type RecurringOverride,
  type SetRecurringOverrideInput,
} from '@repo/types';
import { recurringOverrides$ } from '@/lib/store';
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
  };

  const existing = Object.values(
    (recurringOverrides$.peek() ?? {}) as Record<string, RecurringOverrideRow | undefined>,
  ).find((row) => row?.user_id === userId && row.series_key === data.seriesKey);
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

/** Forget the verdict, so the detector decides on its own again. */
export function clearRecurringOverride(id: string): void {
  patchRow(recurringOverrides$, id, { deleted: true, updated_at: new Date().toISOString() });
}
