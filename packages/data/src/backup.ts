import { syncState, when, type Observable } from '@legendapp/state';
import {
  planDebtStatus,
  planImportRows,
  STORE_TABLE_NAMES,
  TABLE_ORDER,
  toFinanceDebt,
  toFinanceDebtActivity,
  type ImportPlan,
  type RawRow,
  type StoreSnapshot,
  type TableName,
} from '@repo/core';

import { applyWrites } from './apply';
import type { MoniStore } from './store';

type Tables = Pick<MoniStore, 'tables'>;

export type ApplyProgress = { done: number; total: number };

export type ApplyPlanOptions = {
  /** Ids for a CSV's rows, which have none until they are written. */
  newId: () => string;
  onProgress?: (progress: ApplyProgress) => void;
};

const CHUNK = 100;
/** How long to wait on the server before carrying on: offline, sets queue and sync later. */
const SETTLE_MS = 15_000;

function tableOf(store: Tables, table: TableName) {
  return store.tables[STORE_TABLE_NAMES[table]] as unknown as Observable<Record<string, RawRow | undefined> | null>;
}

/** A table's rows as the store holds them, soft-deleted ones included. */
export function storeRows(store: Tables, table: TableName): RawRow[] {
  const snapshot = tableOf(store, table).peek();
  if (!snapshot || typeof snapshot !== 'object') return [];
  return Object.entries(snapshot).flatMap(([id, row]) =>
    row && typeof row === 'object' ? [{ ...row, id: row.id ?? id }] : [],
  );
}

/** Every table an export or an import reads, as the store holds it this instant. */
export function readStoreSnapshot(store: Tables): StoreSnapshot {
  return {
    wallets: storeRows(store, 'wallets'),
    categories: storeRows(store, 'categories'),
    budgets: storeRows(store, 'budgets'),
    debts: storeRows(store, 'debts'),
    debtActivities: storeRows(store, 'debtActivities'),
    transactions: storeRows(store, 'transactions'),
  };
}

/**
 * True once every table has pulled from the server since the app opened. Until then the store may
 * be missing rows the server holds, and an import would take them for new. `lastSync` can't say
 * this: `enableStoreSync` stamps it even when the pull failed with no signal.
 */
export function storeHasPulled(store: Tables): boolean {
  return TABLE_ORDER.every((table) => syncState(tableOf(store, table)).isLoaded.get());
}

/** Waits for a table's sets to reach the server, so children do not race their parents. */
function makeSettle(store: Tables) {
  let online = true;
  return async (table: TableName) => {
    await new Promise((resolve) => setTimeout(resolve, 0));
    if (!online) return;
    const state$ = syncState(tableOf(store, table));
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timedOut = new Promise<boolean>((resolve) => {
      timer = setTimeout(() => resolve(false), SETTLE_MS);
    });
    online = await Promise.race([when(() => !state$.numPendingSets.get()).then(() => true), timedOut]);
    clearTimeout(timer);
  };
}

/** Works out again the status of each debt a restore added activity to. */
function refreshDebtStatuses(store: Tables, debtIds: readonly string[]): void {
  const byId = <T extends { id: string }>(table: TableName, adapt: (row: RawRow) => T | null) =>
    Object.fromEntries(
      storeRows(store, table).flatMap((row) => {
        const item = adapt(row);
        return item ? [[item.id, item] as const] : [];
      }),
    );
  const view = {
    debtsById: byId('debts', toFinanceDebt),
    debtActivitiesById: byId('debtActivities', toFinanceDebtActivity),
  };
  const now = new Date().toISOString();
  for (const debtId of debtIds) {
    const plan = planDebtStatus(debtId, view, { now });
    if (plan.kind === 'writes') applyWrites(store, plan.writes);
  }
}

/**
 * Writes a plan through the store with Legend's own create path: no `created_at` on a row is what
 * makes it a create. Parents go first and rows go in chunks, so a very long file does not freeze
 * the screen or open thousands of requests at once. Stopping anywhere is safe: the next run plans
 * from what the store then holds and writes the rest. Returns how many rows it wrote.
 */
export async function applyPlan(
  store: Pick<MoniStore, 'tables' | 'isMigrated'>,
  plan: ImportPlan,
  { newId, onProgress }: ApplyPlanOptions,
): Promise<number> {
  const writes: Partial<Record<TableName, RawRow[]>> =
    plan.kind === 'restore'
      ? plan.writes
      : { transactions: plan.writes.map((row) => ({ ...row, id: newId() })) };
  const total = TABLE_ORDER.reduce((sum, table) => sum + (writes[table]?.length ?? 0), 0);
  const settle = makeSettle(store);
  const isMigrated = store.isMigrated;
  let done = 0;
  for (const table of TABLE_ORDER) {
    const rows = writes[table] ?? [];
    for (let at = 0; at < rows.length; at += CHUNK) {
      applyWrites(store, planImportRows(STORE_TABLE_NAMES[table], rows.slice(at, at + CHUNK), { isMigrated }));
      done += Math.min(CHUNK, rows.length - at);
      onProgress?.({ done, total });
      await settle(table);
    }
  }
  if (plan.kind === 'restore') refreshDebtStatuses(store, plan.debtsToRefresh);
  return total;
}
