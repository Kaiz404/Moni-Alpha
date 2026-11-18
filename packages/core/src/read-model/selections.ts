import { addMinor, subtractMinor, type CurrencyCode, type MinorAmount } from '@repo/types';

import type { Calendar } from '../calendar';
import { countsAsSpending, debtBalance, walletEffect } from '../ledger';
import { hideShadowedPresets } from './category-presets';
import { transactionWalletIds } from './projection';
import type {
  FinanceBudget,
  FinanceCategory,
  FinanceDebt,
  FinanceDebtActivity,
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

export type CategoryChoice = { id: string; name: string; icon: string | null; color: string | null };

export type CategoryListRow = CategoryChoice & {
  userId: string | null;
  type: 'income' | 'expense' | null;
  isActive: boolean;
};

export type DebtWithBalance = { debt: FinanceDebt; balanceMinor: MinorAmount };

export type CurrencyNetWorth = {
  currency: CurrencyCode;
  cashMinor: MinorAmount;
  receivableMinor: MinorAmount;
  payableMinor: MinorAmount;
  netWorthMinor: MinorAmount;
};

export type TransactionFilter = {
  userId: string | null;
  walletId?: string;
  categoryId?: string;
  currency?: string;
  month?: string;
  limit?: number;
};

function values<T>(record: Record<string, T>): T[] {
  return Object.values(record);
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

/** The user's active wallets in the order they arranged them. */
export function walletsForUser(
  walletsById: Record<string, FinanceWallet>,
  userId: string | null,
): FinanceWallet[] {
  return values(walletsById)
    .filter((wallet) => wallet.isActive && wallet.userId === userId)
    .sort((a, b) => a.displayOrder - b.displayOrder || a.name.localeCompare(b.name));
}

/** A wallet's starting balance moved by every transaction that touches it. */
export function walletBalance(
  wallet: FinanceWallet,
  transactions: readonly FinanceTransaction[],
): MinorAmount {
  return addMinor(
    wallet.initialBalanceMinor,
    ...transactions.map((transaction) => walletEffect(transaction, wallet.id)),
  );
}

/** Each wallet's balance added up per currency. */
export function balanceTotals(
  wallets: readonly FinanceWallet[],
  balancesByWallet: Record<string, MinorAmount>,
): CurrencyTotal[] {
  const totals = new Map<CurrencyCode, MinorAmount>();
  for (const wallet of wallets)
    addCurrencyTotal(totals, wallet.currency, balancesByWallet[wallet.id] ?? (0 as MinorAmount));
  return currencyTotals(totals);
}

/** The user's transactions that pass the filter, newest first. */
export function filterTransactions(
  transactions: readonly FinanceTransaction[],
  filter: TransactionFilter,
): FinanceTransaction[] {
  const rows: FinanceTransaction[] = [];
  for (const transaction of transactions) {
    if (transaction.userId !== filter.userId) continue;
    if (filter.categoryId && transaction.categoryId !== filter.categoryId) continue;
    if (filter.currency && transaction.currency !== filter.currency.toUpperCase()) continue;
    if (filter.month && transaction.transactionDate.slice(0, 7) !== filter.month) continue;
    rows.push(transaction);
  }
  const sorted = sortTransactions(rows);
  return filter.limit ? sorted.slice(0, filter.limit) : sorted;
}

/** The presets and the user's own categories, by id. */
export function userCategoriesById(
  categoriesById: Record<string, FinanceCategory>,
  userId: string | null,
): Record<string, FinanceCategory> {
  return Object.fromEntries(
    values(categoriesById)
      .filter((category) => category.userId === null || category.userId === userId)
      .map((category) => [category.id, category]),
  );
}

/** Active category names by id, the presets' and the user's own. */
export function categoryNameMap(
  categoriesById: Record<string, FinanceCategory>,
  userId: string | null,
): Record<string, string> {
  const map: Record<string, string> = {};
  for (const category of values(categoriesById)) {
    if (category.isActive && (category.userId === null || category.userId === userId))
      map[category.id] = category.name;
  }
  return map;
}

/** What pickers and lists show; lookups by id use every category, since a row may point at any. */
function listedCategories(categories: readonly FinanceCategory[]): FinanceCategory[] {
  return hideShadowedPresets(categories, (category) => category);
}

/** The active expense categories a picker offers, from the user's synced categories. */
export function expenseCategories(
  categories: readonly FinanceCategory[],
  userId: string | null,
): CategoryChoice[] {
  return listedCategories(categories)
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
    }));
}

/** Every listed category, by type, then the user's order. */
export function categoryList(categories: readonly FinanceCategory[]): CategoryListRow[] {
  return listedCategories(categories)
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
    }));
}

/** Four most recently used active expense categories for the lightweight budget form. */
export function recentExpenseCategories(
  categories: readonly FinanceCategory[],
  transactions: readonly FinanceTransaction[],
  userId: string | null,
): CategoryChoice[] {
  const byId = Object.fromEntries(categories.map((category) => [category.id, category]));
  const seen = new Set<string>();
  const recent = transactions
    .filter((transaction) => transaction.userId === userId && transaction.type === 'expense')
    .sort((a, b) => b.transactionDate.localeCompare(a.transactionDate));
  const output: CategoryChoice[] = [];
  for (const transaction of recent) {
    if (!transaction.categoryId || seen.has(transaction.categoryId)) continue;
    const category = byId[transaction.categoryId];
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
}

export function categoryExpensesByCurrency(
  transactions: FinanceTransaction[],
  categories: Record<string, FinanceCategory>,
): Record<string, CategoryExpense[]> {
  const byCurrency = new Map<CurrencyCode, Map<string, CategoryExpense>>();
  for (const transaction of transactions) {
    if (!countsAsSpending(transaction)) continue;
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
        running = addMinor(running, walletEffect(transaction, walletId));
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

/**
 * Spending against each budget in the month `now` falls in, per category and currency. A
 * category is near its limit from 75% of the budget.
 */
export function budgetProgress({
  categoriesById,
  budgetsById,
  transactions,
  userId,
  calendar,
  now,
}: {
  categoriesById: Record<string, FinanceCategory>;
  budgetsById: Record<string, FinanceBudget>;
  /** The user's transactions. */
  transactions: readonly FinanceTransaction[];
  userId: string | null;
  calendar: Calendar;
  now: Date;
}): BudgetProgress[] {
  const categories = userCategoriesById(categoriesById, userId);
  const budgets = values(budgetsById).filter((budget) => budget.userId === userId);
  const month = calendar.monthKey(now);
  const spent = new Map<string, MinorAmount>();
  for (const transaction of transactions) {
    if (!countsAsSpending(transaction) || !transaction.categoryId) continue;
    if (calendar.monthKey(transaction.transactionDate) !== month) continue;
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
        (b.percentage ?? -1) - (a.percentage ?? -1) || Number(b.spentMinor) - Number(a.spentMinor),
    );
}

/** The user's debts with what is still owed on each; `activitiesOf` gives a debt's activities. */
export function debtsWithBalance(
  debtsById: Record<string, FinanceDebt>,
  userId: string | null,
  activitiesOf: (debtId: string) => readonly FinanceDebtActivity[],
): DebtWithBalance[] {
  return values(debtsById)
    .filter((debt) => debt.userId === userId)
    .map((debt) => ({ debt, balanceMinor: debtBalance(activitiesOf(debt.id)) }));
}

/** Cash in wallets plus what others owe minus what the user owes, per currency. */
export function netWorthByCurrency(
  wallets: readonly FinanceWallet[],
  balancesByWallet: Record<string, MinorAmount>,
  debts: readonly DebtWithBalance[],
): CurrencyNetWorth[] {
  const totals = new Map<
    CurrencyCode,
    {
      cashMinor: MinorAmount;
      receivableMinor: MinorAmount;
      payableMinor: MinorAmount;
    }
  >();
  for (const wallet of wallets) {
    const total = totals.get(wallet.currency) ?? {
      cashMinor: 0 as MinorAmount,
      receivableMinor: 0 as MinorAmount,
      payableMinor: 0 as MinorAmount,
    };
    total.cashMinor = addMinor(total.cashMinor, balancesByWallet[wallet.id] ?? (0 as MinorAmount));
    totals.set(wallet.currency, total);
  }
  for (const { debt, balanceMinor } of debts) {
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
}

/** Captures waiting for review that have an amount and a type, newest first. */
export function pendingProposals(
  proposalsById: Record<string, FinanceProposal>,
  userId: string | null,
): FinanceProposal[] {
  return values(proposalsById)
    .filter(
      (proposal) =>
        proposal.userId === userId && proposal.amountMinor !== null && proposal.type !== null,
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
