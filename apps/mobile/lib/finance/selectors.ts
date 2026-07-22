import { computed, type Observable } from '@legendapp/state';
import { addMinor, subtractMinor, type CurrencyCode, type MinorAmount } from '@repo/types';
import { categories$ } from '@/lib/store';
import { toFinanceCategory } from './adapters';
import { monthKeyInTimezone } from './dates';
import { outstandingDebtBalanceMinor, transactionDeltaMinor } from './ledger';
import { financeProjection$ } from './projection';
import type {
  FinanceCategory,
  FinanceDebt,
  FinanceProposal,
  FinanceTransaction,
  FinanceWallet,
} from './types';

export type CurrencyTotal = {
  currency: CurrencyCode;
  amountMinor: MinorAmount;
};
export type FinanceChartPoint = { x: Date; yMinor: MinorAmount };
export type CurrencyLine = {
  currency: CurrencyCode;
  points: FinanceChartPoint[];
};
export type FinancePinPoint = {
  latitude: number;
  longitude: number;
  transactionCount: number;
  locationName: string;
  description: string;
  amountsByCurrency: CurrencyTotal[];
};
export type BudgetProgress = {
  categoryId: string;
  categoryName: string;
  categoryIcon: string | null;
  categoryColor: string | null;
  categoryIsActive: boolean;
  currency: CurrencyCode;
  budgetAmountMinor: MinorAmount | null;
  spentMinor: MinorAmount;
  remainingMinor: MinorAmount | null;
  percentage: number | null;
  status: 'unbudgeted' | 'on_track' | 'near_limit' | 'over';
};

/** Category metadata is carried into charts rather than recreated in views. */
export type CategoryExpense = {
  categoryId: string | null;
  name: string;
  icon: string | null;
  color: string | null;
  /** Compatibility fields for existing finance/AI consumers. */
  x: string;
  yMinor: MinorAmount;
};

function values<T>(record: Record<string, T>): T[] {
  return Object.values(record);
}

/**
 * Category selection is deliberately sourced from the synced category table,
 * not the derived finance projection. This keeps system presets available to
 * forms immediately after a full sync or catalogue reseed.
 */
function syncedCategoriesForUser(userId: string | null): FinanceCategory[] {
  const rows = categories$.get() as Record<string, Record<string, unknown> | undefined>;
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

function sortTransactions(transactions: FinanceTransaction[]): FinanceTransaction[] {
  return [...transactions].sort((a, b) => b.transactionDate.localeCompare(a.transactionDate));
}

function addCurrencyTotal(
  totals: Map<CurrencyCode, MinorAmount>,
  currency: CurrencyCode,
  amountMinor: MinorAmount,
): void {
  totals.set(currency, addMinor(totals.get(currency) ?? 0, amountMinor));
}

function currencyTotals(totals: Map<CurrencyCode, MinorAmount>): CurrencyTotal[] {
  return [...totals.entries()]
    .map(([currency, amountMinor]) => ({ currency, amountMinor }))
    .sort((a, b) => a.currency.localeCompare(b.currency));
}

const walletCache = new Map<string, Observable<FinanceWallet[]>>();
export function walletsForUser$(userId: string | null): Observable<FinanceWallet[]> {
  return cacheComputed(walletCache, userId ?? 'anonymous', () =>
    values(financeProjection$.walletsById.get())
      .filter((wallet) => wallet.isActive && wallet.userId === userId)
      .sort((a, b) => a.displayOrder - b.displayOrder || a.name.localeCompare(b.name)),
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
    return addMinor(
      wallet.initialBalanceMinor,
      ...ids.map((id) => {
        const transaction = financeProjection$.transactionsById[id].get();
        return transaction ? transactionDeltaMinor(transaction, walletId) : (0 as MinorAmount);
      }),
    );
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

type TransactionFilter = {
  userId: string | null;
  walletId?: string;
  categoryId?: string;
  currency?: string;
  month?: string;
  limit?: number;
};
const transactionListCache = new Map<string, Observable<FinanceTransaction[]>>();
export function transactions$(filter: TransactionFilter): Observable<FinanceTransaction[]> {
  const key = JSON.stringify(filter);
  return cacheComputed(transactionListCache, key, () => {
    const ids = filter.walletId
      ? (financeProjection$.transactionsByWallet[filter.walletId].get() ?? [])
      : Object.keys(financeProjection$.transactionsById.get());
    const rows: FinanceTransaction[] = [];
    for (const id of ids) {
      const transaction = financeProjection$.transactionsById[id].get();
      if (!transaction || transaction.userId !== filter.userId) continue;
      if (filter.categoryId && transaction.categoryId !== filter.categoryId) continue;
      if (filter.currency && transaction.currency !== filter.currency.toUpperCase()) continue;
      if (filter.month && transaction.transactionDate.slice(0, 7) !== filter.month) continue;
      rows.push(transaction);
    }
    const sorted = sortTransactions(rows);
    return filter.limit ? sorted.slice(0, filter.limit) : sorted;
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
  return cacheComputed(categoryMapCache, userId ?? 'anonymous', () => {
    const map: Record<string, string> = {};
    for (const category of values(financeProjection$.categoriesById.get())) {
      if (category.isActive && (category.userId === null || category.userId === userId))
        map[category.id] = category.name;
    }
    return map;
  });
}

const expenseCategoriesCache = new Map<
  string,
  Observable<{ id: string; name: string; icon: string | null; color: string | null }[]>
>();
export function expenseCategories$(
  userId: string | null,
): Observable<{ id: string; name: string; icon: string | null; color: string | null }[]> {
  return cacheComputed(expenseCategoriesCache, userId ?? 'anonymous', () =>
    syncedCategoriesForUser(userId)
      .filter(
        (category) =>
          category.isActive &&
          category.type === 'expense' &&
          (category.userId === null || category.userId === userId),
      )
      .sort((a, b) => a.displayOrder - b.displayOrder || a.name.localeCompare(b.name))
      .map((category) => ({
        id: category.id,
        name: category.name,
        icon: category.icon,
        color: category.color,
      })),
  );
}

const categoryListCache = new Map<
  string,
  Observable<
    {
      id: string;
      userId: string | null;
      name: string;
      icon: string | null;
      color: string | null;
      type: 'income' | 'expense' | null;
      isActive: boolean;
    }[]
  >
>();

export function categoriesForUser$(userId: string | null) {
  return cacheComputed(categoryListCache, userId ?? 'anonymous', () =>
    syncedCategoriesForUser(userId)
      .sort(
        (a, b) =>
          a.type?.localeCompare(b.type ?? '') ||
          a.displayOrder - b.displayOrder ||
          a.name.localeCompare(b.name),
      )
      .map((category) => ({
        id: category.id,
        userId: category.userId,
        name: category.name,
        icon: category.icon,
        color: category.color,
        type: category.type,
        isActive: category.isActive,
      })),
  );
}

const recentExpenseCategoriesCache = new Map<
  string,
  Observable<
    {
      id: string;
      name: string;
      icon: string | null;
      color: string | null;
    }[]
  >
>();

/** Four most recently used active expense categories for the lightweight budget form. */
export function recentExpenseCategories$(userId: string | null) {
  return cacheComputed(recentExpenseCategoriesCache, userId ?? 'anonymous', () => {
    const categories = Object.fromEntries(
      syncedCategoriesForUser(userId).map((category) => [category.id, category]),
    );
    const seen = new Set<string>();
    const recent = values(financeProjection$.transactionsById.get())
      .filter((transaction) => transaction.userId === userId && transaction.type === 'expense')
      .sort((a, b) => b.transactionDate.localeCompare(a.transactionDate));
    const output: { id: string; name: string; icon: string | null; color: string | null }[] = [];
    for (const transaction of recent) {
      if (!transaction.categoryId || seen.has(transaction.categoryId)) continue;
      const category = categories[transaction.categoryId];
      if (!category || !category.isActive || category.type !== 'expense') continue;
      seen.add(category.id);
      output.push({
        id: category.id,
        name: category.name,
        icon: category.icon,
        color: category.color,
      });
      if (output.length === 4) break;
    }
    return output;
  });
}

export function categoryExpensesByCurrency(
  transactions: FinanceTransaction[],
  categories: Record<string, FinanceCategory>,
): Record<string, CategoryExpense[]> {
  const byCurrency = new Map<CurrencyCode, Map<string, CategoryExpense>>();
  for (const transaction of transactions) {
    if (transaction.type !== 'expense' || transaction.analysisExcluded) continue;
    const totals = byCurrency.get(transaction.currency) ?? new Map<string, CategoryExpense>();
    const category = transaction.categoryId ? categories[transaction.categoryId] : null;
    const key = category?.id ?? '__uncategorized';
    const previous = totals.get(key);
    totals.set(key, {
      categoryId: category?.id ?? null,
      name: category?.name ?? 'Uncategorized',
      icon: category?.icon ?? null,
      color: category?.color ?? null,
      x: category?.name ?? 'Uncategorized',
      yMinor: addMinor(previous?.yMinor ?? (0 as MinorAmount), transaction.amountMinor),
    });
    byCurrency.set(transaction.currency, totals);
  }
  return Object.fromEntries(
    [...byCurrency.entries()].map(([currency, totals]) => {
      const entries = [...totals.entries()]
        .map(([, entry]) => entry)
        .sort((a, b) => Number(b.yMinor) - Number(a.yMinor));
      if (entries.length <= 6) return [currency, entries];
      return [
        currency,
        [
          ...entries.slice(0, 5),
          {
            categoryId: null,
            name: 'Other',
            icon: null,
            color: null,
            x: 'Other',
            yMinor: addMinor(...entries.slice(5).map((entry) => entry.yMinor)),
          },
        ],
      ];
    }),
  );
}

export function balanceLinesByCurrency(
  wallets: FinanceWallet[],
  transactions: FinanceTransaction[],
): CurrencyLine[] {
  const byCurrency = new Map<CurrencyCode, FinanceWallet[]>();
  for (const wallet of wallets)
    byCurrency.set(wallet.currency, [...(byCurrency.get(wallet.currency) ?? []), wallet]);
  const output: CurrencyLine[] = [];
  for (const [currency, group] of byCurrency) {
    const walletIds = new Set(group.map((wallet) => wallet.id));
    let running = addMinor(...group.map((wallet) => wallet.initialBalanceMinor));
    const relevant = [...transactions]
      .filter(
        (transaction) =>
          transaction.currency === currency &&
          (walletIds.has(transaction.walletId) ||
            (transaction.transferToWalletId !== null &&
              walletIds.has(transaction.transferToWalletId))),
      )
      .sort((a, b) => a.transactionDate.localeCompare(b.transactionDate));
    const points: FinanceChartPoint[] = [];
    if (!relevant.length) points.push({ x: new Date(), yMinor: running });
    for (const transaction of relevant) {
      for (const walletId of transactionWalletIds(transaction).filter((id) => walletIds.has(id))) {
        running = addMinor(running, transactionDeltaMinor(transaction, walletId));
      }
      points.push({
        x: new Date(transaction.transactionDate),
        yMinor: running,
      });
    }
    output.push({ currency, points });
  }
  return output.sort((a, b) => a.currency.localeCompare(b.currency));
}

function transactionWalletIds(transaction: FinanceTransaction): string[] {
  return [
    ...new Set([transaction.walletId, transaction.transferToWalletId].filter(Boolean) as string[]),
  ];
}

const overviewCache = new Map<
  string,
  Observable<{
    wallets: FinanceWallet[];
    balancesByWallet: Record<string, MinorAmount>;
    balanceTotals: CurrencyTotal[];
    transactions: FinanceTransaction[];
    categoryNames: Record<string, string>;
    categoriesById: Record<string, FinanceCategory>;
    categoryExpensesByCurrency: Record<string, CategoryExpense[]>;
    balanceLines: CurrencyLine[];
  }>
>();
export function financeOverview$(userId: string | null): Observable<{
  wallets: FinanceWallet[];
  balancesByWallet: Record<string, MinorAmount>;
  balanceTotals: CurrencyTotal[];
  transactions: FinanceTransaction[];
  categoryNames: Record<string, string>;
  categoriesById: Record<string, FinanceCategory>;
  categoryExpensesByCurrency: Record<string, CategoryExpense[]>;
  balanceLines: CurrencyLine[];
}> {
  return cacheComputed(overviewCache, userId ?? 'anonymous', () => {
    const wallets = walletsForUser$(userId).get();
    const balancesByWallet = walletBalancesMinor$(userId).get();
    const transactions = transactions$({ userId }).get();
    const categoryNames = categoryNameMap$(userId).get();
    const categoriesById = Object.fromEntries(
      values(financeProjection$.categoriesById.get())
        .filter((category) => category.userId === null || category.userId === userId)
        .map((category) => [category.id, category]),
    );
    const totals = new Map<CurrencyCode, MinorAmount>();
    for (const wallet of wallets)
      addCurrencyTotal(totals, wallet.currency, balancesByWallet[wallet.id] ?? (0 as MinorAmount));
    return {
      wallets,
      balancesByWallet,
      balanceTotals: currencyTotals(totals),
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
  return cacheComputed(budgetCache, `${userId ?? 'anonymous'}:${timezone}`, () => {
    const categories = Object.fromEntries(
      values(financeProjection$.categoriesById.get())
        .filter((category) => category.userId === null || category.userId === userId)
        .map((category) => [category.id, category]),
    );
    const budgets = values(financeProjection$.budgetsById.get()).filter(
      (budget) => budget.userId === userId,
    );
    const transactions = transactions$({ userId }).get();
    const month = monthKeyInTimezone(new Date(), timezone);
    const spent = new Map<string, MinorAmount>();
    for (const transaction of transactions) {
      if (transaction.type !== 'expense' || transaction.analysisExcluded || !transaction.categoryId)
        continue;
      if (monthKeyInTimezone(transaction.transactionDate, timezone) !== month) continue;
      const key = `${transaction.categoryId}:${transaction.currency}`;
      spent.set(key, addMinor(spent.get(key) ?? 0, transaction.amountMinor));
    }
    const budgetByKey = new Map(
      budgets.map((budget) => [`${budget.categoryId}:${budget.currency}`, budget]),
    );
    return [...new Set([...spent.keys(), ...budgetByKey.keys()])]
      .map((key) => {
        const [categoryId, currency] = key.split(':') as [string, CurrencyCode];
        const budget = budgetByKey.get(key);
        const spentMinor = spent.get(key) ?? (0 as MinorAmount);
        const budgetAmountMinor = budget?.amountMinor ?? null;
        const remainingMinor =
          budgetAmountMinor === null ? null : subtractMinor(budgetAmountMinor, spentMinor);
        const percentage =
          budgetAmountMinor === null || budgetAmountMinor === 0
            ? null
            : Math.round((Number(spentMinor) / Number(budgetAmountMinor)) * 1000) / 10;
        return {
          categoryId,
          categoryName: categories[categoryId]?.name ?? 'Uncategorized',
          categoryIcon: categories[categoryId]?.icon ?? null,
          categoryColor: categories[categoryId]?.color ?? null,
          categoryIsActive: categories[categoryId]?.isActive ?? false,
          currency,
          budgetAmountMinor,
          spentMinor,
          remainingMinor,
          percentage,
          status:
            budgetAmountMinor === null
              ? 'unbudgeted'
              : Number(spentMinor) > Number(budgetAmountMinor)
                ? 'over'
                : Number(spentMinor) >= Number(budgetAmountMinor) * 0.75
                  ? 'near_limit'
                  : 'on_track',
        } satisfies BudgetProgress;
      })
      .sort(
        (a, b) =>
          (b.percentage ?? -1) - (a.percentage ?? -1) ||
          Number(b.spentMinor) - Number(a.spentMinor),
      );
  });
}

const debtsCache = new Map<
  string,
  Observable<{ debt: FinanceDebt; balanceMinor: MinorAmount }[]>
>();
export function debtsWithBalance$(
  userId: string | null,
): Observable<{ debt: FinanceDebt; balanceMinor: MinorAmount }[]> {
  return cacheComputed(debtsCache, userId ?? 'anonymous', () => {
    return values(financeProjection$.debtsById.get())
      .filter((debt) => debt.userId === userId)
      .map((debt) => ({
        debt,
        balanceMinor: outstandingDebtBalanceMinor(
          (financeProjection$.debtActivityIdsByDebt[debt.id].get() ?? [])
            .map((activityId) => financeProjection$.debtActivitiesById[activityId].get())
            .filter((activity): activity is NonNullable<typeof activity> => Boolean(activity)),
        ),
      }));
  });
}

const netWorthCache = new Map<
  string,
  Observable<
    {
      currency: CurrencyCode;
      cashMinor: MinorAmount;
      receivableMinor: MinorAmount;
      payableMinor: MinorAmount;
      netWorthMinor: MinorAmount;
    }[]
  >
>();
export function netWorthByCurrency$(userId: string | null): Observable<
  {
    currency: CurrencyCode;
    cashMinor: MinorAmount;
    receivableMinor: MinorAmount;
    payableMinor: MinorAmount;
    netWorthMinor: MinorAmount;
  }[]
> {
  return cacheComputed(netWorthCache, userId ?? 'anonymous', () => {
    const totals = new Map<
      CurrencyCode,
      {
        cashMinor: MinorAmount;
        receivableMinor: MinorAmount;
        payableMinor: MinorAmount;
      }
    >();
    for (const wallet of walletsForUser$(userId).get()) {
      const total = totals.get(wallet.currency) ?? {
        cashMinor: 0 as MinorAmount,
        receivableMinor: 0 as MinorAmount,
        payableMinor: 0 as MinorAmount,
      };
      total.cashMinor = addMinor(total.cashMinor, walletBalanceMinor$(wallet.id).get());
      totals.set(wallet.currency, total);
    }
    for (const { debt, balanceMinor } of debtsWithBalance$(userId).get()) {
      const total = totals.get(debt.currency) ?? {
        cashMinor: 0 as MinorAmount,
        receivableMinor: 0 as MinorAmount,
        payableMinor: 0 as MinorAmount,
      };
      if (debt.direction === 'owed_to_me')
        total.receivableMinor = addMinor(total.receivableMinor, balanceMinor);
      else total.payableMinor = addMinor(total.payableMinor, balanceMinor);
      totals.set(debt.currency, total);
    }
    return [...totals.entries()]
      .map(([currency, total]) => ({
        currency,
        ...total,
        netWorthMinor: subtractMinor(
          addMinor(total.cashMinor, total.receivableMinor),
          total.payableMinor,
        ),
      }))
      .sort((a, b) => a.currency.localeCompare(b.currency));
  });
}

const pinCache = new Map<
  string,
  Observable<{
    pinPoints: FinancePinPoint[];
    mapRegion: {
      latitude: number;
      longitude: number;
      latitudeDelta: number;
      longitudeDelta: number;
    };
  }>
>();
export function pinmap$(userId: string | null): Observable<{
  pinPoints: FinancePinPoint[];
  mapRegion: {
    latitude: number;
    longitude: number;
    latitudeDelta: number;
    longitudeDelta: number;
  };
}> {
  return cacheComputed(pinCache, userId ?? 'anonymous', () => {
    const locations = new Map<
      string,
      FinancePinPoint & { totals: Map<CurrencyCode, MinorAmount> }
    >();
    for (const transaction of transactions$({ userId }).get()) {
      if (transaction.locationLatitude === null || transaction.locationLongitude === null) continue;
      const key = `${transaction.locationLatitude.toFixed(4)},${transaction.locationLongitude.toFixed(4)}`;
      const existing = locations.get(key) ?? {
        latitude: transaction.locationLatitude,
        longitude: transaction.locationLongitude,
        transactionCount: 0,
        locationName: transaction.locationName ?? 'Saved transaction location',
        description: transaction.description ?? transaction.merchant ?? 'No description',
        amountsByCurrency: [],
        totals: new Map<CurrencyCode, MinorAmount>(),
      };
      existing.transactionCount += 1;
      addCurrencyTotal(existing.totals, transaction.currency, transaction.amountMinor);
      locations.set(key, existing);
    }
    const pinPoints = [...locations.values()].map(({ totals, ...point }) => ({
      ...point,
      amountsByCurrency: currencyTotals(totals),
    }));
    if (!pinPoints.length)
      return {
        pinPoints,
        mapRegion: {
          latitude: 0,
          longitude: 0,
          latitudeDelta: 180,
          longitudeDelta: 360,
        },
      };
    const latitudes = pinPoints.map((point) => point.latitude);
    const longitudes = pinPoints.map((point) => point.longitude);
    return {
      pinPoints,
      mapRegion: {
        latitude: (Math.min(...latitudes) + Math.max(...latitudes)) / 2,
        longitude: (Math.min(...longitudes) + Math.max(...longitudes)) / 2,
        latitudeDelta: Math.max(Math.max(...latitudes) - Math.min(...latitudes), 0.1) * 1.2,
        longitudeDelta: Math.max(Math.max(...longitudes) - Math.min(...longitudes), 0.1) * 1.2,
      },
    };
  });
}

const proposalsCache = new Map<string, Observable<FinanceProposal[]>>();
export function pendingProposals$(userId: string | null) {
  return cacheComputed(proposalsCache, userId ?? 'anonymous', () =>
    values(financeProjection$.proposalsById.get())
      .filter(
        (proposal) =>
          proposal.userId === userId && proposal.amountMinor !== null && proposal.type !== null,
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
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
