/** Deterministic calendar-month budget metrics. Amounts become decimals only in the AI wire snapshot. */
import {
  addMinor,
  minorToNumber,
  subtractMinor,
  type BudgetCoachToolSnapshot,
  type MinorAmount,
} from '@repo/types';

import type { Calendar } from '../calendar';
import { countsAsSpending } from '../ledger';
import type { TxForMetrics } from './insight-metrics';

export type BudgetForMetrics = {
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

type CategoryTotals = {
  total: MinorAmount;
  dining: MinorAmount;
  grocery: MinorAmount;
  other: MinorAmount;
  count: number;
  merchants: Record<string, MinorAmount>;
};

export function buildBudgetCoachSnapshot(
  transactions: readonly TxForMetrics[],
  categoryMap: Record<string, string>,
  budgets: readonly BudgetForMetrics[],
  currencyHint: string,
  now: Date,
  calendar: Calendar,
): BudgetCoachToolSnapshot {
  const sortedBudgets = [...budgets].sort((a, b) =>
    `${a.currency}:${a.categoryId}`.localeCompare(`${b.currency}:${b.categoryId}`),
  );
  const monthKey = calendar.monthKey(now);
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
      !countsAsSpending(tx) ||
      !tx.categoryId ||
      calendar.monthKey(tx.transactionDate) !== monthKey
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
    const total = totals[`${budget.categoryId}:${budget.currency.toUpperCase()}`]!;
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
    monthKey,
    currencyHint,
    generatedAt: now.toISOString(),
    categories,
  };
}
