import { batch, observable, type Observable } from '@legendapp/state';
import {
  categoryBudgets$,
  categories$,
  debtActivities$,
  debts$,
  proposedTransactions$,
  transactions$,
  wallets$,
} from '@/lib/store';
import {
  emptyProjection,
  type FinanceDebtActivity,
  type FinanceProjection,
  type FinanceTransaction,
  projectFinance,
  type RawTable,
  sortedInsert,
  toFinanceBudget,
  toFinanceCategory,
  toFinanceDebt,
  toFinanceDebtActivity,
  toFinanceProposal,
  toFinanceTransaction,
  toFinanceWallet,
  transactionWalletIds,
} from '@repo/core';

type Adapter<T> = (row: Record<string, unknown>) => T | null;

/**
 * Ephemeral normalized read model. It is intentionally not persisted: the
 * Legend synced tables remain the sole source of truth and MMKV cache.
 */
export const financeProjection$ = observable<FinanceProjection>(emptyProjection());

function activityDebtIds(activity: Pick<FinanceDebtActivity, 'debtId'>): string[] {
  return activity.debtId ? [activity.debtId] : [];
}

function removeIndexEntry(index$: any, indexId: string, itemId: string): void {
  const current = (index$[indexId].peek() as string[] | undefined) ?? [];
  const next = current.filter((id) => id !== itemId);
  if (next.length) index$[indexId].set(next);
  else index$[indexId].delete();
}

function upsertTransaction(id: string, next: FinanceTransaction | null): void {
  const previous = financeProjection$.transactionsById[id].peek() as FinanceTransaction | undefined;
  for (const walletId of previous ? transactionWalletIds(previous) : []) {
    removeIndexEntry(financeProjection$.transactionsByWallet, walletId, id);
  }
  if (!next) {
    financeProjection$.transactionsById[id].delete();
    return;
  }
  financeProjection$.transactionsById[id].set(next);
  for (const walletId of transactionWalletIds(next)) {
    const existing =
      (financeProjection$.transactionsByWallet[walletId].peek() as string[] | undefined) ?? [];
    financeProjection$.transactionsByWallet[walletId].set(
      sortedInsert(
        existing,
        id,
        (transactionId) =>
          (
            financeProjection$.transactionsById[transactionId].peek() as
              | FinanceTransaction
              | undefined
          )?.transactionDate ?? '',
      ),
    );
  }
}

function upsertDebtActivity(id: string, next: FinanceDebtActivity | null): void {
  const previous = financeProjection$.debtActivitiesById[id].peek() as
    | FinanceDebtActivity
    | undefined;
  for (const debtId of previous ? activityDebtIds(previous) : []) {
    removeIndexEntry(financeProjection$.debtActivityIdsByDebt, debtId, id);
  }
  if (!next) {
    financeProjection$.debtActivitiesById[id].delete();
    return;
  }
  financeProjection$.debtActivitiesById[id].set(next);
  const existing =
    (financeProjection$.debtActivityIdsByDebt[next.debtId].peek() as string[] | undefined) ?? [];
  financeProjection$.debtActivityIdsByDebt[next.debtId].set(
    sortedInsert(
      existing,
      id,
      (activityId) =>
        (
          financeProjection$.debtActivitiesById[activityId].peek() as
            | FinanceDebtActivity
            | undefined
        )?.activityDate ?? '',
    ),
  );
}

function readRaw(table$: Observable<any>): RawTable {
  const value = table$.peek();
  return value && typeof value === 'object' ? (value as RawTable) : {};
}

/** Initial hydration is O(n); subsequent Legend table changes update only changed rows/indexes. */
export function rehydrateFinanceProjection(): void {
  financeProjection$.set(
    projectFinance({
      wallets: readRaw(wallets$),
      transactions: readRaw(transactions$),
      categories: readRaw(categories$),
      budgets: readRaw(categoryBudgets$),
      debts: readRaw(debts$),
      debtActivities: readRaw(debtActivities$),
      proposals: readRaw(proposedTransactions$),
    }),
  );
}

function changedRowIds(changes: Array<{ path: string[] }>): string[] | null {
  const ids = new Set<string>();
  for (const change of changes) {
    if (!change.path.length) return null;
    ids.add(change.path[0]);
  }
  return [...ids];
}

function subscribeRows<T>(
  table$: Observable<any>,
  adapter: Adapter<T>,
  apply: (id: string, entity: T | null) => void,
): () => void {
  return table$.onChange(({ changes }) => {
    const ids = changedRowIds(changes);
    if (!ids) {
      rehydrateFinanceProjection();
      return;
    }
    const raw = readRaw(table$);
    batch(() => {
      for (const id of ids) {
        const row = raw[id];
        apply(id, row && !row.deleted ? adapter({ ...row, id }) : null);
      }
    });
  });
}

let stopProjection: (() => void) | null = null;

/** Start once for an authenticated Legend sync lifecycle; callers must clean it up on sign-out. */
export function startFinanceProjection(): () => void {
  stopProjection?.();
  rehydrateFinanceProjection();
  const stops = [
    subscribeRows(wallets$, toFinanceWallet, (id, entity) => {
      if (entity) financeProjection$.walletsById[id].set(entity);
      else financeProjection$.walletsById[id].delete();
    }),
    subscribeRows(transactions$, toFinanceTransaction, upsertTransaction),
    subscribeRows(categories$, toFinanceCategory, (id, entity) => {
      if (entity) financeProjection$.categoriesById[id].set(entity);
      else financeProjection$.categoriesById[id].delete();
    }),
    subscribeRows(categoryBudgets$, toFinanceBudget, (id, entity) => {
      if (entity) financeProjection$.budgetsById[id].set(entity);
      else financeProjection$.budgetsById[id].delete();
    }),
    subscribeRows(debts$, toFinanceDebt, (id, entity) => {
      if (entity) financeProjection$.debtsById[id].set(entity);
      else financeProjection$.debtsById[id].delete();
    }),
    subscribeRows(debtActivities$, toFinanceDebtActivity, upsertDebtActivity),
    subscribeRows(proposedTransactions$, toFinanceProposal, (id, entity) => {
      if (entity) financeProjection$.proposalsById[id].set(entity);
      else financeProjection$.proposalsById[id].delete();
    }),
  ];
  stopProjection = () => {
    for (const stop of stops) stop();
    stopProjection = null;
    financeProjection$.set(emptyProjection());
  };
  return stopProjection;
}

export function stopFinanceProjection(): void {
  stopProjection?.();
}
