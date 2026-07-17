/**
 * Deterministic finance metrics snapshot for chat analysis.
 */
import {
  buildBudgetCoachSnapshot,
  type BudgetCoachToolSnapshot,
  type BudgetRow,
} from '../insights/budget-coach-metrics';
import {
  buildInsightMetricSnapshot,
  type InsightMetricSnapshot,
  type TxForMetrics,
} from '../insights/insight-metrics';
import { addMinor, minorToNumber, type MinorAmount } from '@repo/types';

export type { BudgetRow, TxForMetrics };

export type CalendarMonthTrendSnapshot = {
  currencyHint: string;
  currentMonthKey: string;
  previousMonthKey: string;
  expenseCurrentMonthToDate: number;
  expensePreviousCalendarMonth: number;
  dayOfMonthNow: number;
  daysInCurrentMonth: number;
  avgDailyExpenseCurrentMonth: number;
  avgDailyExpensePreviousMonth: number;
  pctExpenseChangeVsPreviousFullMonth: number | null;
};

export type SpendingStorySnapshot = {
  currencyHint: string;
  periodLabel: string;
  topCategories: { name: string; amount: number; sharePct: number }[];
  topMerchants: { name: string; amount: number; sharePct: number }[];
  categoryConcentration: number;
  expenseTransactionCount: number;
};

export type FinanceAssistantCurrencySnapshot = {
  generatedAt: string;
  rolling30: InsightMetricSnapshot;
  calendarMonth: CalendarMonthTrendSnapshot;
  budgetCoach: BudgetCoachToolSnapshot;
  spendingStory: SpendingStorySnapshot;
};

/** Chat payload: every metric is scoped to exactly one currency. */
export type FinanceAssistantToolSnapshot = {
  schema: 'finance_assistant_tool_v2';
  generatedAt: string;
  currencies: Record<string, FinanceAssistantCurrencySnapshot>;
};

function sumExpenseInRange(txs: TxForMetrics[], startMs: number, endMs: number): MinorAmount {
  let s = 0 as MinorAmount;
  for (const tx of txs) {
    if (tx.type !== 'expense' || tx.analysisExcluded) continue;
    const t = new Date(tx.transactionDate).getTime();
    if (t >= startMs && t <= endMs) s = addMinor(s, tx.amountMinor);
  }
  return s;
}

export function buildCalendarMonthTrendSnapshot(
  transactions: TxForMetrics[],
  currencyHint: string,
  now: Date = new Date(),
): CalendarMonthTrendSnapshot {
  const y = now.getFullYear();
  const m = now.getMonth();
  const currentMonthKey = `${y}-${String(m + 1).padStart(2, '0')}`;
  const prev = m === 0 ? { y: y - 1, m: 11 } : { y, m: m - 1 };
  const previousMonthKey = `${prev.y}-${String(prev.m + 1).padStart(2, '0')}`;

  const startCurr = new Date(y, m, 1).getTime();
  const endNow = now.getTime();
  const startPrev = new Date(prev.y, prev.m, 1).getTime();
  const endPrev = new Date(prev.y, prev.m + 1, 0, 23, 59, 59, 999).getTime();

  const expenseCurrentMonthToDateMinor = sumExpenseInRange(transactions, startCurr, endNow);
  const expensePreviousCalendarMonthMinor = sumExpenseInRange(transactions, startPrev, endPrev);
  const expenseCurrentMonthToDate = minorToNumber(expenseCurrentMonthToDateMinor);
  const expensePreviousCalendarMonth = minorToNumber(expensePreviousCalendarMonthMinor);

  const dayOfMonthNow = now.getDate();
  const daysInCurrentMonth = new Date(y, m + 1, 0).getDate();

  const avgDailyExpenseCurrentMonth =
    dayOfMonthNow > 0 ? Math.round((expenseCurrentMonthToDate / dayOfMonthNow) * 100) / 100 : 0;
  const daysInPrevMonth = new Date(prev.y, prev.m + 1, 0).getDate();
  const avgDailyExpensePreviousMonth =
    daysInPrevMonth > 0
      ? Math.round((expensePreviousCalendarMonth / daysInPrevMonth) * 100) / 100
      : 0;

  let pctExpenseChangeVsPreviousFullMonth: number | null = null;
  if (expensePreviousCalendarMonth > 0) {
    const projected = avgDailyExpenseCurrentMonth * daysInCurrentMonth || expenseCurrentMonthToDate;
    pctExpenseChangeVsPreviousFullMonth =
      Math.round(
        ((projected - expensePreviousCalendarMonth) / expensePreviousCalendarMonth) * 1000,
      ) / 10;
  } else if (expenseCurrentMonthToDate > 0) {
    pctExpenseChangeVsPreviousFullMonth = 100;
  }

  return {
    currencyHint: currencyHint || 'USD',
    currentMonthKey,
    previousMonthKey,
    expenseCurrentMonthToDate,
    expensePreviousCalendarMonth,
    dayOfMonthNow,
    daysInCurrentMonth,
    avgDailyExpenseCurrentMonth,
    avgDailyExpensePreviousMonth,
    pctExpenseChangeVsPreviousFullMonth,
  };
}

export function buildSpendingStorySnapshot(
  transactions: TxForMetrics[],
  categoryMap: Record<string, string>,
  currencyHint: string,
  now: Date = new Date(),
): SpendingStorySnapshot {
  const rolling = buildInsightMetricSnapshot(transactions, categoryMap, currencyHint, now);
  const total = rolling.current.expenseTotal || 1;
  const topCategories = rolling.topCategories.slice(0, 5).map((c) => ({
    ...c,
    sharePct: Math.round((c.amount / total) * 1000) / 10,
  }));
  const topMerchants = rolling.topMerchants.slice(0, 5).map((m) => ({
    ...m,
    sharePct: Math.round((m.amount / total) * 1000) / 10,
  }));
  const endMs = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime();
  const startMs = endMs - 30 * 86400000;
  const catShares: Record<string, MinorAmount> = {};
  for (const tx of transactions) {
    if (tx.type !== 'expense' || tx.analysisExcluded) continue;
    const t = new Date(tx.transactionDate).getTime();
    if (t < startMs || t >= endMs) continue;
    const name =
      tx.categoryId && categoryMap[tx.categoryId] ? categoryMap[tx.categoryId] : 'Uncategorized';
    catShares[name] = addMinor(catShares[name] ?? 0, tx.amountMinor);
  }
  const shares = Object.values(catShares).map((amountMinor) => minorToNumber(amountMinor) / total);
  const hhi = shares.reduce((s, p) => s + p * p, 0);

  let expenseTx = 0;
  for (const tx of transactions) {
    if (tx.type !== 'expense' || tx.analysisExcluded) continue;
    const t = new Date(tx.transactionDate).getTime();
    if (t >= startMs && t < endMs) expenseTx += 1;
  }

  return {
    currencyHint: currencyHint || 'USD',
    periodLabel: `last ${rolling.periodDays} days`,
    topCategories,
    topMerchants,
    categoryConcentration: Math.round(hhi * 1000) / 1000,
    expenseTransactionCount: expenseTx,
  };
}

function buildFinanceAssistantCurrencySnapshot(
  transactions: TxForMetrics[],
  categoryMap: Record<string, string>,
  budgets: BudgetRow[],
  currencyHint: string,
  now: Date = new Date(),
): FinanceAssistantCurrencySnapshot {
  const rolling30 = buildInsightMetricSnapshot(transactions, categoryMap, currencyHint, now);
  const calendarMonth = buildCalendarMonthTrendSnapshot(transactions, currencyHint, now);
  const budgetCoach = buildBudgetCoachSnapshot(
    transactions,
    categoryMap,
    budgets,
    currencyHint,
    now,
  );
  const spendingStory = buildSpendingStorySnapshot(transactions, categoryMap, currencyHint, now);

  return {
    generatedAt: now.toISOString(),
    rolling30,
    calendarMonth,
    budgetCoach,
    spendingStory,
  };
}

export function buildFinanceAssistantToolSnapshotByCurrency(
  transactions: TxForMetrics[],
  categoryMap: Record<string, string>,
  budgets: BudgetRow[],
  now: Date = new Date(),
): FinanceAssistantToolSnapshot {
  const currencies = new Set([
    ...transactions.map((transaction) => (transaction.currency ?? 'USD').toUpperCase()),
    ...budgets.map((budget) => budget.currency.toUpperCase()),
  ]);
  const snapshots = Object.fromEntries(
    [...currencies].sort().map((currency) => [
      currency,
      buildFinanceAssistantCurrencySnapshot(
        transactions.filter(
          (transaction) => (transaction.currency ?? 'USD').toUpperCase() === currency,
        ),
        categoryMap,
        budgets.filter((budget) => budget.currency.toUpperCase() === currency),
        currency,
        now,
      ),
    ]),
  );
  return {
    schema: 'finance_assistant_tool_v2',
    generatedAt: now.toISOString(),
    currencies: snapshots,
  };
}
