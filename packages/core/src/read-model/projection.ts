import {
  toFinanceBudget,
  toFinanceCategory,
  toFinanceDebt,
  toFinanceDebtActivity,
  toFinanceProposal,
  toFinanceTransaction,
  toFinanceWallet,
} from './rows';
import type { FinanceProjection, FinanceTransaction } from './types';

/** One synced table as stored: rows by id, soft-deleted rows included. */
export type RawTable = Record<string, Record<string, unknown> | undefined>;

export type RawFinanceTables = {
  wallets: RawTable;
  transactions: RawTable;
  categories: RawTable;
  budgets: RawTable;
  debts: RawTable;
  debtActivities: RawTable;
  proposals: RawTable;
};

export function emptyProjection(): FinanceProjection {
  return {
    walletsById: {},
    transactionsById: {},
    transactionsByWallet: {},
    categoriesById: {},
    budgetsById: {},
    debtsById: {},
    debtActivitiesById: {},
    debtActivityIdsByDebt: {},
    proposalsById: {},
  };
}

/** `ids` with `id` in place, newest `dateForId` first. */
export function sortedInsert(
  ids: string[],
  id: string,
  dateForId: (id: string) => string,
): string[] {
  const without = ids.filter((current) => current !== id);
  without.push(id);
  return without.sort((a, b) => dateForId(b).localeCompare(dateForId(a)));
}

/** The wallets a transaction moves: its own, and the one a transfer goes to. */
export function transactionWalletIds(
  transaction: Pick<FinanceTransaction, 'walletId' | 'transferToWalletId'>,
): string[] {
  return [
    ...new Set([transaction.walletId, transaction.transferToWalletId].filter(Boolean) as string[]),
  ];
}

function mapRows<T>(
  table: RawTable,
  adapter: (row: Record<string, unknown>) => T | null,
): Record<string, T> {
  const mapped: Record<string, T> = {};
  for (const [id, row] of Object.entries(table)) {
    if (!row || row.deleted) continue;
    const entity = adapter({ ...row, id });
    if (entity) mapped[id] = entity;
  }
  return mapped;
}

/** The read model of every synced finance table, with transactions by wallet and activities by debt, newest first. */
export function projectFinance(tables: RawFinanceTables): FinanceProjection {
  const projection = emptyProjection();
  projection.walletsById = mapRows(tables.wallets, toFinanceWallet);
  projection.transactionsById = mapRows(tables.transactions, toFinanceTransaction);
  projection.categoriesById = mapRows(tables.categories, toFinanceCategory);
  projection.budgetsById = mapRows(tables.budgets, toFinanceBudget);
  projection.debtsById = mapRows(tables.debts, toFinanceDebt);
  projection.debtActivitiesById = mapRows(tables.debtActivities, toFinanceDebtActivity);
  projection.proposalsById = mapRows(tables.proposals, toFinanceProposal);

  for (const transaction of Object.values(projection.transactionsById)) {
    for (const walletId of transactionWalletIds(transaction)) {
      projection.transactionsByWallet[walletId] = sortedInsert(
        projection.transactionsByWallet[walletId] ?? [],
        transaction.id,
        (id) => projection.transactionsById[id]?.transactionDate ?? '',
      );
    }
  }
  for (const activity of Object.values(projection.debtActivitiesById)) {
    projection.debtActivityIdsByDebt[activity.debtId] = sortedInsert(
      projection.debtActivityIdsByDebt[activity.debtId] ?? [],
      activity.id,
      (id) => projection.debtActivitiesById[id]?.activityDate ?? '',
    );
  }
  return projection;
}
