/** Deterministic calendar-month budget metrics. Amounts become decimals only in the AI wire snapshot. */
import { addMinor, minorToNumber, subtractMinor, type MinorAmount } from '@repo/types';
import type { TxForMetrics } from './insight-metrics';

export type BudgetRow = {
  categoryId: string;
  currency: string;
  amountMinor: MinorAmount;
};
const zero = 0 as MinorAmount;

function classifyMerchantLine(
  merchant: string | null | undefined,
): 'dining_out' | 'grocery' | 'other' {
  const value = (merchant ?? '').toLowerCase();
  if (
    /grocery|supermarket|tesco|giant|cold\s*storage|jaya\s*grocer|99\s*speed|fairprice|ntuc|village\s*grocer|mart\b|market\b|wholefoods|costco|carrefour|aeon|lotus/i.test(
      value,
    )
  )
    return 'grocery';
  if (
    /restaurant|cafe|coffee|mcd|kfc|starbucks|grab\s*food|foodpanda|deliver|takeaway|uber\s*eats|pizza|sushi|ramen|hawker|mamak|restoran|dining|eatery|bakery|bistro|bar\s*&\s*grill|toast\s*box|subway|texas\s*chicken/i.test(
      value,
    )
  )
    return 'dining_out';
  return 'other';
}

function inCalendarMonth(isoDate: string, year: number, monthIndex: number): boolean {
  const date = new Date(isoDate);
  return date.getFullYear() === year && date.getMonth() === monthIndex;
}

export type BudgetCategoryMetric = {
  categoryId: string;
  categoryName: string;
  currency: string;
  budgetAmount: number;
  spentTotal: number;
  pctOfBudget: number | null;
  remaining: number;
  txCount: number;
  spendDiningOutLike: number;
  spendGroceryLike: number;
  spendOther: number;
  diningOutSharePct: number | null;
  topMerchants: { name: string; amount: number }[];
};
export type BudgetCoachToolSnapshot = {
  schema: 'budget_coach_tool_v1';
  monthKey: string;
  currencyHint: string;
  generatedAt: string;
  categories: BudgetCategoryMetric[];
};

type CategoryTotals = {
  total: MinorAmount;
  dining: MinorAmount;
  grocery: MinorAmount;
  other: MinorAmount;
  count: number;
  merchants: Record<string, MinorAmount>;
};

export function buildBudgetCoachSnapshot(
  transactions: TxForMetrics[],
  categoryMap: Record<string, string>,
  budgets: BudgetRow[],
  currencyHint: string,
  now: Date = new Date(),
): BudgetCoachToolSnapshot {
  const sortedBudgets = [...budgets].sort((a, b) =>
    `${a.currency}:${a.categoryId}`.localeCompare(`${b.currency}:${b.categoryId}`),
  );
  const year = now.getFullYear();
  const month = now.getMonth();
  const totals: Record<string, CategoryTotals> = {};
  for (const budget of sortedBudgets)
    totals[`${budget.categoryId}:${budget.currency.toUpperCase()}`] = {
      total: zero,
      dining: zero,
      grocery: zero,
      other: zero,
      count: 0,
      merchants: {},
    };

  for (const tx of transactions) {
    if (
      tx.type !== 'expense' ||
      tx.analysisExcluded ||
      !tx.categoryId ||
      !inCalendarMonth(tx.transactionDate, year, month)
    )
      continue;
    const target = totals[`${tx.categoryId}:${(tx.currency ?? currencyHint).toUpperCase()}`];
    if (!target) continue;
    target.total = addMinor(target.total, tx.amountMinor);
    target.count += 1;
    const kind = classifyMerchantLine(tx.merchant);
    target[kind === 'dining_out' ? 'dining' : kind] = addMinor(
      target[kind === 'dining_out' ? 'dining' : kind],
      tx.amountMinor,
    );
    const merchant = (tx.merchant?.trim() || 'Unknown').slice(0, 80);
    target.merchants[merchant] = addMinor(target.merchants[merchant] ?? zero, tx.amountMinor);
  }

  const categories = sortedBudgets.map((budget) => {
    const total = totals[`${budget.categoryId}:${budget.currency.toUpperCase()}`];
    const budgetAmount = minorToNumber(budget.amountMinor);
    const spentTotal = minorToNumber(total.total);
    const topMerchants = Object.entries(total.merchants)
      .map(([name, amountMinor]) => ({
        name,
        amount: minorToNumber(amountMinor),
      }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 4);
    return {
      categoryId: budget.categoryId,
      categoryName: categoryMap[budget.categoryId] ?? 'Category',
      currency: budget.currency.toUpperCase(),
      budgetAmount,
      spentTotal,
      pctOfBudget:
        budget.amountMinor > 0
          ? Math.round((Number(total.total) / Number(budget.amountMinor)) * 1000) / 10
          : null,
      remaining: minorToNumber(subtractMinor(budget.amountMinor, total.total)),
      txCount: total.count,
      spendDiningOutLike: minorToNumber(total.dining),
      spendGroceryLike: minorToNumber(total.grocery),
      spendOther: minorToNumber(total.other),
      diningOutSharePct:
        total.total > 0
          ? Math.round((Number(total.dining) / Number(total.total)) * 1000) / 10
          : null,
      topMerchants,
    };
  });
  return {
    schema: 'budget_coach_tool_v1',
    monthKey: `${year}-${String(month + 1).padStart(2, '0')}`,
    currencyHint: currencyHint || 'USD',
    generatedAt: now.toISOString(),
    categories,
  };
}

export function stableBudgetCoachSnapshotString(snapshot: BudgetCoachToolSnapshot): string {
  return JSON.stringify(snapshot);
}
