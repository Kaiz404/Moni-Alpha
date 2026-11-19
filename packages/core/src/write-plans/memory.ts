import type { RowWrites, SyncedTable } from './types';

export type MemoryTables = Partial<Record<SyncedTable, Record<string, Record<string, unknown>>>>;

function isLive(row: Record<string, unknown> | undefined): boolean {
  return Boolean(row && !row.deleted);
}

/**
 * Carries writes out over plain tables, the way the store's applier does over Legend: all or
 * nothing, and a patch or soft delete needs a live row (or one inserted in the same writes).
 */
export function applyToTables(tables: MemoryTables, writes: RowWrites): MemoryTables {
  const next: MemoryTables = Object.fromEntries(
    Object.entries(tables).map(([table, rows]) => [table, { ...rows }]),
  );
  const rowsOf = (table: SyncedTable) => (next[table] ??= {});
  for (const { table, row } of writes.insert) rowsOf(table)[row.id] = { ...row };
  for (const target of [...writes.patch, ...writes.softDelete]) {
    if (!isLive(rowsOf(target.table)[target.id])) throw new Error(`Cannot patch missing row: ${target.id}`);
  }
  for (const { table, id, patch } of writes.patch) rowsOf(table)[id] = { ...rowsOf(table)[id], ...patch };
  for (const { table, id, at } of writes.softDelete) {
    rowsOf(table)[id] = { ...rowsOf(table)[id], deleted: true, updated_at: at };
  }
  return next;
}
