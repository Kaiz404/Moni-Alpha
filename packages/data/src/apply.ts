import { batch, type Observable } from '@legendapp/state';
import type { RowWrites, SyncedTable } from '@repo/core';

import type { MoniStore } from './store';

type Tables = Pick<MoniStore, 'tables'>;

/** A plan's writes pair each table with its own row type, which TypeScript cannot follow through a union. */
function rowsOf(store: Tables, table: SyncedTable) {
  return store.tables[table] as unknown as Observable<Record<string, Record<string, unknown>>>;
}

function isLive(store: Tables, table: SyncedTable, id: string, inserted: ReadonlySet<string>): boolean {
  if (inserted.has(`${table}/${id}`)) return true;
  const row = rowsOf(store, table).peek()?.[id];
  return row != null && typeof row === 'object' && !row.deleted;
}

/**
 * Carries a write plan out on the store in one Legend batch; sync then sends each row. A create is
 * a row set without `created_at`. All or nothing: a patch or soft delete whose row is missing
 * throws before anything is written.
 */
export function applyWrites(store: Tables, writes: RowWrites): void {
  const inserted = new Set(writes.insert.map(({ table, row }) => `${table}/${row.id}`));
  for (const { table, id } of [...writes.patch, ...writes.softDelete]) {
    if (!isLive(store, table, id, inserted)) throw new Error(`Cannot patch missing row: ${id}`);
  }
  batch(() => {
    for (const { table, row } of writes.insert) rowsOf(store, table)[row.id]!.set(row);
    for (const { table, id, patch } of writes.patch) rowsOf(store, table)[id]!.assign(patch);
    for (const { table, id, at } of writes.softDelete) {
      rowsOf(store, table)[id]!.assign({ deleted: true, updated_at: at });
    }
  });
}
