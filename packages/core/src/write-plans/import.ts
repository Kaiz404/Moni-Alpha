import type { PlanContext, RowInsert, RowWrites, StoredRow, SyncedTable } from './types';

type ImportTable = 'wallets' | 'categories' | 'category_budgets' | 'debts' | 'debt_activities' | 'transactions';

/**
 * Rows an import creates, without the columns the server does not have yet: an unknown column
 * fails every later sync of its row. Without the place ID column, Google's coordinates could never
 * be refreshed, so they go too.
 */
export function planImportRows<T extends ImportTable>(
  table: T,
  rows: readonly Record<string, unknown>[],
  ctx: Pick<PlanContext, 'isMigrated'>,
): RowWrites {
  const insert = rows.map((source) => {
    const row: Record<string, unknown> = { ...source };
    if (!ctx.isMigrated('merchant_aliases_and_wallet_location')) delete row.record_location;
    if (table === 'transactions' && !ctx.isMigrated('transaction_place_ids')) {
      if (row.place_coords_at) {
        row.location_latitude = null;
        row.location_longitude = null;
      }
      delete row.place_id;
      delete row.place_coords_at;
    }
    // An import row comes from a file `@repo/types` already parsed; the store takes it as its table's row.
    return { table, row: row as StoredRow<SyncedTable> } as RowInsert;
  });
  return { insert, patch: [], softDelete: [] };
}
