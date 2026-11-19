import type { RowInsert, RowPatch, RowWrites, SyncedTable } from './types';

/** A row as the store held it before the writes, or undefined when it did not exist. */
export type RowBefore = (table: SyncedTable, id: string) => Record<string, unknown> | undefined;

/**
 * The writes that put rows back as they were before `writes`, for a toast's Undo: an insert is
 * soft-deleted, a patch gets its old values back, and a soft-deleted row is written again whole and
 * live, since a patch only reaches a live row. Every row it touches gets `updated_at` `now`, so the
 * server and other devices take the undo as the newest change.
 */
export function undoWrites(writes: RowWrites, before: RowBefore, now: string): RowWrites {
  const deleted = new Set(writes.softDelete.map(({ table, id }) => `${table}/${id}`));
  const inserted = new Set(writes.insert.map(({ table, row }) => `${table}/${row.id}`));
  const insert: RowInsert[] = [];
  const patch: RowPatch[] = [];
  for (const { table, id } of writes.softDelete) {
    const row = before(table, id);
    if (row && !inserted.has(`${table}/${id}`)) insert.push({ table, row: { ...row, id, deleted: false, updated_at: now } } as RowInsert);
  }
  for (const { table, id, patch: change } of writes.patch) {
    const key = `${table}/${id}`;
    if (deleted.has(key) || inserted.has(key)) continue;
    const row = before(table, id);
    if (!row) continue;
    const back: Record<string, unknown> = { updated_at: now };
    for (const column of Object.keys(change)) if (column !== 'updated_at') back[column] = row[column] ?? null;
    patch.push({ table, id, patch: back } as RowPatch);
  }
  return {
    insert,
    patch,
    softDelete: writes.insert.map(({ table, row }) => ({ table, id: row.id, at: now })),
  };
}
