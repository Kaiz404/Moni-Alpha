import { batch } from '@legendapp/state';
import type { RowWrites, SyncedTable } from '@repo/core';

import type { MoniStore } from './store';

type Tables = Pick<MoniStore, 'tables'>;

function isLive(store: Tables, table: SyncedTable, id: string, inserted: ReadonlySet<string>): boolean {
  if (inserted.has(`${table}/${id}`)) return true;
  const row = (store.tables[table].peek() as Record<string, { deleted?: boolean } | undefined> | null)?.[id];
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
    for (const { table, row } of writes.insert) store.tables[table][row.id]!.set(row);
    for (const { table, id, patch } of writes.patch) store.tables[table][id]!.assign(patch);
    for (const { table, id, at } of writes.softDelete) {
      store.tables[table][id]!.assign({ deleted: true, updated_at: at });
    }
  });
}
