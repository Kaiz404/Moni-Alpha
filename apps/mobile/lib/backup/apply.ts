import { batch, syncState, when } from '@legendapp/state';
import { randomUUID } from 'expo-crypto';

import { refreshLinkedPackagesFromStore } from '@/lib/notifications/linked-packages-cache';
import { isMigrated } from '@/lib/store';
import { refreshDebtStatus } from '@/lib/supabase/debts';

import type { RawRow, TableName } from './moni-export';
import { TABLE_ORDER } from './moni-export';
import type { ImportPlan } from './plan';
import { STORE_TABLES } from './store-tables';

export type ApplyProgress = { done: number; total: number };

const CHUNK = 100;
/** How long to wait on the server before carrying on: offline, sets queue and sync later. */
const SETTLE_MS = 15_000;

/** Waits for a table's sets to reach the server, so children do not race their parents. */
function makeSettle() {
  let online = true;
  return async (table: TableName) => {
    await new Promise((resolve) => setTimeout(resolve, 0));
    if (!online) return;
    const state$ = syncState(STORE_TABLES[table]);
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timedOut = new Promise<boolean>((resolve) => {
      timer = setTimeout(() => resolve(false), SETTLE_MS);
    });
    online = await Promise.race([when(() => !state$.numPendingSets.get()).then(() => true), timedOut]);
    clearTimeout(timer);
  };
}

/**
 * Writes a plan through the store with Legend's own create path: no `created_at` on a row is what
 * makes it a create. Parents go first and rows go in chunks, so a very long file does not freeze
 * the screen or open thousands of requests at once. Stopping anywhere is safe: the next run plans
 * from what the store then holds and writes the rest.
 */
export async function applyPlan(
  plan: ImportPlan,
  onProgress?: (progress: ApplyProgress) => void,
): Promise<number> {
  const writes: Partial<Record<TableName, RawRow[]>> =
    plan.kind === 'restore'
      ? plan.writes
      : { transactions: plan.writes.map((row) => ({ ...row, id: randomUUID() })) };
  const total = TABLE_ORDER.reduce((sum, table) => sum + (writes[table]?.length ?? 0), 0);
  const settle = makeSettle();
  let done = 0;
  for (const table of TABLE_ORDER) {
    const rows = writes[table] ?? [];
    for (let at = 0; at < rows.length; at += CHUNK) {
      batch(() => {
        for (const row of rows.slice(at, at + CHUNK)) writeRow(table, row);
      });
      done += Math.min(CHUNK, rows.length - at);
      onProgress?.({ done, total });
      await settle(table);
    }
  }
  if (plan.kind === 'restore') {
    if (plan.writes.wallets.length) refreshLinkedPackagesFromStore();
    for (const debtId of plan.debtsToRefresh) await refreshDebtStatus(debtId);
  }
  return total;
}

function writeRow(table: TableName, row: RawRow): void {
  const value = { ...row };
  // Before its migration, an unknown column would fail every later sync of this wallet (wallets.ts).
  if (!isMigrated('merchant_aliases_and_wallet_location')) delete value.record_location;
  STORE_TABLES[table][String(row.id)].set(value);
}
