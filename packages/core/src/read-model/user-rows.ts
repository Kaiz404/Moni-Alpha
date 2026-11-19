import { decimalToMinor, type MerchantAlias, type RecurringOverride } from '@repo/types';

import { isLiveRow } from './rows';
import type { RawTable } from './projection';

const text = (value: unknown): string | null => (typeof value === 'string' && value !== '' ? value : null);

/** The user's verdicts on recurring series, one per series: offline devices can each write one, so the latest wins. */
export function recurringOverridesFromRows(table: RawTable, userId: string | null): RecurringOverride[] {
  const latest = new Map<string, RecurringOverride>();
  for (const row of Object.values(table)) {
    if (!isLiveRow(row) || row.user_id !== userId || !text(row.series_key)) continue;
    const override: RecurringOverride = {
      id: row.id,
      userId: String(row.user_id),
      seriesKey: String(row.series_key),
      status: row.status === 'dismissed' ? 'dismissed' : 'confirmed',
      kind: row.kind === 'income' || row.kind === 'bill' || row.kind === 'subscription' ? row.kind : null,
      expectedAmountMinor:
        row.expected_amount === null || row.expected_amount === undefined
          ? null
          : decimalToMinor(row.expected_amount as string | number),
      expectedDay: typeof row.expected_day === 'number' ? row.expected_day : null,
      currency: String(row.currency ?? '').toUpperCase(),
      skipPeriod: text(row.skip_period),
      remind: row.remind === true,
      name: text(row.name),
      walletId: text(row.wallet_id),
      categoryId: text(row.category_id),
      dueOnce: text(row.due_once),
      createdAt: text(row.created_at) ?? '',
      updatedAt: text(row.updated_at) ?? text(row.created_at) ?? '',
    };
    const current = latest.get(override.seriesKey);
    if (!current || override.updatedAt > current.updatedAt) latest.set(override.seriesKey, override);
  }
  return [...latest.values()];
}

/** The names the user gave merchants, one per raw key, the latest winning. */
export function merchantAliasesFromRows(table: RawTable, userId: string | null): MerchantAlias[] {
  const latest = new Map<string, MerchantAlias>();
  for (const row of Object.values(table)) {
    if (!isLiveRow(row) || row.user_id !== userId) continue;
    const rawKey = text(row.raw_key);
    const displayName = text(row.display_name);
    if (!rawKey || !displayName) continue;
    const alias: MerchantAlias = {
      id: row.id,
      userId: String(row.user_id),
      rawKey,
      displayName,
      createdAt: text(row.created_at) ?? '',
      updatedAt: text(row.updated_at) ?? text(row.created_at) ?? '',
      deleted: false,
    };
    const current = latest.get(rawKey);
    if (!current || alias.updatedAt > current.updatedAt) latest.set(rawKey, alias);
  }
  return [...latest.values()];
}
