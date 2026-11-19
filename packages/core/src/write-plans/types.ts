import type { Json, TablesInsert, TablesUpdate } from '@repo/types/database';

import type { FinanceProjection } from '../read-model/types';

/** Tables the store mirrors, each with `id`, `created_at`, `updated_at` and `deleted`. */
export const SYNCED_TABLES = [
  'wallets',
  'transactions',
  'categories',
  'tags',
  'transaction_tags',
  'category_budgets',
  'debts',
  'debt_activities',
  'proposed_transactions',
  'recurring_overrides',
  'auto_add_rules',
  'merchant_aliases',
] as const;

export type SyncedTable = (typeof SYNCED_TABLES)[number];

/**
 * `numeric` money columns. A pull brings them as numbers; a local write keeps the exact decimal
 * string `minorToDecimal` makes, so a float never rounds a cent.
 */
type DecimalColumn = 'amount' | 'initial_balance' | 'expected_amount';

/** A `jsonb` column. Legend's observable types recurse through the generated `Json` without end. */
export type JsonColumn = Record<string, unknown> | unknown[] | string | number | boolean | null | undefined;

type Stored<Shape> = {
  [K in keyof Shape]: K extends DecimalColumn ? Shape[K] | string : Json extends Shape[K] ? JsonColumn : Shape[K];
};

/**
 * A row as a device holds it: everything a pull brings, or only what a local create set before the
 * server filled its defaults (`created_at`, `updated_at`).
 */
export type StoredRow<T extends SyncedTable> = Stored<TablesInsert<T>> & { id: string };
export type StoredPatch<T extends SyncedTable> = Stored<TablesUpdate<T>>;

export type RowInsert = { [T in SyncedTable]: { table: T; row: StoredRow<T> } }[SyncedTable];
export type RowPatch = { [T in SyncedTable]: { table: T; id: string; patch: StoredPatch<T> } }[SyncedTable];
/** Synced rows are never `DELETE`d: a device pulling by `updated_at` would never learn of it. */
export type RowSoftDelete = { table: SyncedTable; id: string; at: string };

/** What a command writes, for one applier per platform to carry out in one batch. */
export type RowWrites = {
  insert: RowInsert[];
  patch: RowPatch[];
  softDelete: RowSoftDelete[];
};

/** A command's answer: the writes and what they mean, or why nothing can be written yet. */
export type Planned<Result = null> =
  | { kind: 'writes'; writes: RowWrites; result: Result }
  | { kind: 'needsInput'; field: 'wallet' | 'destination' }
  | { kind: 'error'; message: string };

/** Migrations whose columns a plan leaves out until the server has them. */
export type GatedColumns = 'transaction_place_ids' | 'merchant_aliases_and_wallet_location';

/** What a plan needs beyond the ledger: who writes, when, fresh ids, and which columns exist. */
export type PlanContext = {
  userId: string;
  now: string;
  newId: () => string;
  isMigrated: (migration: GatedColumns) => boolean;
};

/** The ledger a plan reads, as the read model projects it: live rows only. */
export type LedgerView = Pick<
  FinanceProjection,
  'walletsById' | 'transactionsById' | 'debtsById' | 'debtActivitiesById'
>;

export function planned<Result>(parts: Partial<RowWrites>, result: Result): Planned<Result> {
  return {
    kind: 'writes',
    writes: { insert: parts.insert ?? [], patch: parts.patch ?? [], softDelete: parts.softDelete ?? [] },
    result,
  };
}

export function refused(message: string): { kind: 'error'; message: string } {
  return { kind: 'error', message };
}

/** Several plans as one batch, or the first that could not be written. */
export function combine<Result>(plans: Planned<Result>[]): Planned<Result[]> {
  const results: Result[] = [];
  const all: RowWrites = { insert: [], patch: [], softDelete: [] };
  for (const plan of plans) {
    if (plan.kind !== 'writes') return plan;
    all.insert.push(...plan.writes.insert);
    all.patch.push(...plan.writes.patch);
    all.softDelete.push(...plan.writes.softDelete);
    results.push(plan.result);
  }
  return { kind: 'writes', writes: all, result: results };
}
