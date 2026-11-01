import type { Observable } from '@legendapp/state';

import {
  categories$,
  categoryBudgets$,
  debtActivities$,
  debts$,
  transactions$,
  wallets$,
} from '@/lib/store';

import type { BackupTables, RawRow, TableName } from './moni-export';

export const STORE_TABLES: Record<TableName, Observable<any>> = {
  wallets: wallets$,
  categories: categories$,
  budgets: categoryBudgets$,
  debts: debts$,
  debtActivities: debtActivities$,
  transactions: transactions$,
};

/** A table's rows as the store holds them, soft-deleted ones included. */
export function storeRows(table: TableName): RawRow[] {
  const snapshot = STORE_TABLES[table].peek() as Record<string, RawRow | undefined> | null;
  if (!snapshot || typeof snapshot !== 'object') return [];
  return Object.entries(snapshot).flatMap(([id, row]) =>
    row && typeof row === 'object' ? [{ ...row, id: row.id ?? id }] : [],
  );
}

function liveRows(table: TableName, userId: string): RawRow[] {
  return storeRows(table).filter((row) => !row.deleted && row.user_id === userId);
}

/** What an export holds: the user's live rows, archived wallets and system categories too. */
export function readBackupTables(userId: string): BackupTables {
  return {
    wallets: liveRows('wallets', userId),
    categories: storeRows('categories').filter(
      (row) => !row.deleted && (row.user_id === userId || !row.user_id),
    ),
    budgets: liveRows('budgets', userId),
    debts: liveRows('debts', userId),
    debtActivities: liveRows('debtActivities', userId),
    transactions: liveRows('transactions', userId),
  };
}
