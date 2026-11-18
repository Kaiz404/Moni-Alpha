import { computed, type Observable } from '@legendapp/state';
import type { MinorAmount } from '@repo/types';
import {
  balanceLinesByCurrency,
  balanceTotals,
  budgetProgress,
  categoryExpensesByCurrency,
  categoryList,
  categoryNameMap,
  createCalendar,
  debtsWithBalance,
  expenseCategories,
  filterTransactions,
  netWorthByCurrency,
  pendingProposals,
  recentExpenseCategories,
  toFinanceCategory,
  userCategoriesById,
  walletBalance,
  walletsForUser,
  type BudgetProgress,
  type CategoryChoice,
  type CategoryExpense,
  type CategoryListRow,
  type CurrencyLine,
  type CurrencyNetWorth,
  type CurrencyTotal,
  type DebtWithBalance,
  type FinanceCategory,
  type FinanceProposal,
  type FinanceTransaction,
  type FinanceWallet,
  type TransactionFilter,
} from '@repo/core';
import { categories$ } from '@/lib/store';
import { financeProjection$ } from './projection';

function values<T>(record: Record<string, T>): T[] {
  return Object.values(record);
}

/**
 * Category selection is deliberately sourced from the synced category table,
 * not the derived finance projection. This keeps system presets available to
 * forms immediately after a full sync or catalogue reseed.
 */
function syncedCategoriesForUser(userId: string | null): FinanceCategory[] {
  const rows = (categories$.get() ?? {}) as Record<string, Record<string, unknown> | undefined>;
  return Object.entries(rows)
    .map(([key, row]) =>
      row
        ? toFinanceCategory({
            ...row,
            id: typeof row.id === 'string' ? row.id : key,
          })
        : null,
    )
    .filter(
      (category): category is FinanceCategory =>
        category !== null && (category.userId === null || category.userId === userId),
    );
}

function cacheComputed<T>(
  cache: Map<string, Observable<T>>,
  key: string,
  build: () => T,
): Observable<T> {
  let selector$ = cache.get(key);
  if (!selector$) {
    selector$ = computed(build as () => any) as unknown as Observable<T>;
    cache.set(key, selector$);
  }
  return selector$;
}

/** Each row through its own observable, so a change to one row recomputes only what read it. */
function transactionsByIds(ids: readonly string[]): FinanceTransaction[] {
  const rows: FinanceTransaction[] = [];
  for (const id of ids) {
    const transaction = financeProjection$.transactionsById[id].get();
    if (transaction) rows.push(transaction);
  }
  return rows;
}

const walletCache = new Map<string, Observable<FinanceWallet[]>>();
export function walletsForUser$(userId: string | null): Observable<FinanceWallet[]> {
  return cacheComputed(walletCache, userId ?? 'anonymous', () =>
    walletsForUser(financeProjection$.walletsById.get(), userId),
  );
}

const walletByIdCache = new Map<string, Observable<FinanceWallet | null>>();
export function walletById$(walletId: string): Observable<FinanceWallet | null> {
  return cacheComputed(
    walletByIdCache,
    walletId,
    () => financeProjection$.walletsById[walletId].get() ?? null,
  );
}

const balanceCache = new Map<string, Observable<MinorAmount>>();
export function walletBalanceMinor$(walletId: string): Observable<MinorAmount> {
  return cacheComputed(balanceCache, walletId, () => {
    const wallet = financeProjection$.walletsById[walletId].get();
    if (!wallet) return 0 as MinorAmount;
    const ids = financeProjection$.transactionsByWallet[walletId].get() ?? [];
    return walletBalance(wallet, transactionsByIds(ids));
  });
}

const walletBalancesCache = new Map<string, Observable<Record<string, MinorAmount>>>();
export function walletBalancesMinor$(
  userId: string | null,
): Observable<Record<string, MinorAmount>> {
  return cacheComputed(walletBalancesCache, userId ?? 'anonymous', () => {
    const wallets = walletsForUser$(userId).get();
    const output: Record<string, MinorAmount> = {};
    for (const wallet of wallets) output[wallet.id] = walletBalanceMinor$(wallet.id).get();
    return output;
  });
}

const transactionListCache = new Map<string, Observable<FinanceTransaction[]>>();
export function transactions$(filter: TransactionFilter): Observable<FinanceTransaction[]> {
  const key = JSON.stringify(filter);
  return cacheComputed(transactionListCache, key, () => {
    const ids = filter.walletId
      ? (financeProjection$.transactionsByWallet[filter.walletId].get() ?? [])
      : Object.keys(financeProjection$.transactionsById.get());
    return filterTransactions(transactionsByIds(ids), filter);
  });
}

const transactionByIdCache = new Map<string, Observable<FinanceTransaction | null>>();
export function transactionById$(transactionId: string): Observable<FinanceTransaction | null> {
  return cacheComputed(
    transactionByIdCache,
    transactionId,
    () => financeProjection$.transactionsById[transactionId].get() ?? null,
  );
}

const categoryMapCache = new Map<string, Observable<Record<string, string>>>();
export function categoryNameMap$(userId: string | null): Observable<Record<string, string>> {
  return cacheComputed(categoryMapCache, userId ?? 'anonymous', () =>
    categoryNameMap(financeProjection$.categoriesById.get(), userId),
  );
}

const expenseCategoriesCache = new Map<string, Observable<CategoryChoice[]>>();
export function expenseCategories$(userId: string | null): Observable<CategoryChoice[]> {
  return cacheComputed(expenseCategoriesCache, userId ?? 'anonymous', () =>
    expenseCategories(syncedCategoriesForUser(userId), userId),
  );
}

const categoryListCache = new Map<string, Observable<CategoryListRow[]>>();
export function categoriesForUser$(userId: string | null) {
  return cacheComputed(categoryListCache, userId ?? 'anonymous', () =>
    categoryList(syncedCategoriesForUser(userId)),
  );
}

const recentExpenseCategoriesCache = new Map<string, Observable<CategoryChoice[]>>();

/** Four most recently used active expense categories for the lightweight budget form. */
export function recentExpenseCategories$(userId: string | null) {
  return cacheComputed(recentExpenseCategoriesCache, userId ?? 'anonymous', () =>
    recentExpenseCategories(
      syncedCategoriesForUser(userId),
      values(financeProjection$.transactionsById.get()),
      userId,
    ),
  );
}

type FinanceOverview = {
  wallets: FinanceWallet[];
  balancesByWallet: Record<string, MinorAmount>;
  balanceTotals: CurrencyTotal[];
  transactions: FinanceTransaction[];
  categoryNames: Record<string, string>;
  categoriesById: Record<string, FinanceCategory>;
  categoryExpensesByCurrency: Record<string, CategoryExpense[]>;
  balanceLines: CurrencyLine[];
};

const overviewCache = new Map<string, Observable<FinanceOverview>>();
export function financeOverview$(userId: string | null): Observable<FinanceOverview> {
  return cacheComputed(overviewCache, userId ?? 'anonymous', () => {
    const wallets = walletsForUser$(userId).get();
    const balancesByWallet = walletBalancesMinor$(userId).get();
    const transactions = transactions$({ userId }).get();
    const categoryNames = categoryNameMap$(userId).get();
    const categoriesById = userCategoriesById(financeProjection$.categoriesById.get(), userId);
    return {
      wallets,
      balancesByWallet,
      balanceTotals: balanceTotals(wallets, balancesByWallet),
      transactions,
      categoryNames,
      categoriesById,
      categoryExpensesByCurrency: categoryExpensesByCurrency(transactions, categoriesById),
      balanceLines: balanceLinesByCurrency(wallets, transactions),
    };
  });
}

const budgetCache = new Map<string, Observable<BudgetProgress[]>>();
export function budgetProgress$(
  userId: string | null,
  timezone: string,
): Observable<BudgetProgress[]> {
  return cacheComputed(budgetCache, `${userId ?? 'anonymous'}:${timezone}`, () =>
    budgetProgress({
      categoriesById: financeProjection$.categoriesById.get(),
      budgetsById: financeProjection$.budgetsById.get(),
      transactions: transactions$({ userId }).get(),
      userId,
      calendar: createCalendar(timezone),
      now: new Date(),
    }),
  );
}

const debtsCache = new Map<string, Observable<DebtWithBalance[]>>();
export function debtsWithBalance$(userId: string | null): Observable<DebtWithBalance[]> {
  return cacheComputed(debtsCache, userId ?? 'anonymous', () =>
    debtsWithBalance(financeProjection$.debtsById.get(), userId, (debtId) =>
      (financeProjection$.debtActivityIdsByDebt[debtId].get() ?? [])
        .map((activityId) => financeProjection$.debtActivitiesById[activityId].get())
        .filter((activity): activity is NonNullable<typeof activity> => Boolean(activity)),
    ),
  );
}

const netWorthCache = new Map<string, Observable<CurrencyNetWorth[]>>();
export function netWorthByCurrency$(userId: string | null): Observable<CurrencyNetWorth[]> {
  return cacheComputed(netWorthCache, userId ?? 'anonymous', () => {
    const wallets = walletsForUser$(userId).get();
    const balancesByWallet: Record<string, MinorAmount> = {};
    for (const wallet of wallets) balancesByWallet[wallet.id] = walletBalanceMinor$(wallet.id).get();
    return netWorthByCurrency(wallets, balancesByWallet, debtsWithBalance$(userId).get());
  });
}

const proposalsCache = new Map<string, Observable<FinanceProposal[]>>();
export function pendingProposals$(userId: string | null) {
  return cacheComputed(proposalsCache, userId ?? 'anonymous', () =>
    pendingProposals(financeProjection$.proposalsById.get(), userId),
  );
}

/** Explicit, per-currency snapshot for the Go chat boundary. Never sum currencies. */
export function financeSnapshotByCurrency$(userId: string | null) {
  return computed(() => {
    const overview = financeOverview$(userId).get();
    const byCurrency = Object.fromEntries(
      overview.balanceTotals.map(({ currency, amountMinor }) => [
        currency,
        {
          walletBalanceMinor: amountMinor,
          expenseCategories: overview.categoryExpensesByCurrency[currency] ?? [],
        },
      ]),
    );
    return { currencies: byCurrency };
  });
}
