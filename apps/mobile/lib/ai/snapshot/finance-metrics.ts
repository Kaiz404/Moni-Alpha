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

export type FinanceAssistantToolSnapshot = {
  schema: 'finance_assistant_tool_v1';
  generatedAt: string;
  rolling30: InsightMetricSnapshot;
  calendarMonth: CalendarMonthTrendSnapshot;
  budgetCoach: BudgetCoachToolSnapshot;
  spendingStory: SpendingStorySnapshot;
};

function sumExpenseInRange(
  txs: TxForMetrics[],
  startMs: number,
  endMs: number,
): number {
  let s = 0;
  for (const tx of txs) {
    if (tx.type !== 'expense' || tx.analysisExcluded) continue;
    const t = new Date(tx.transactionDate).getTime();
    if (t >= startMs && t <= endMs) s += tx.amount;
  }
  return Math.round(s * 100) / 100;
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

  const expenseCurrentMonthToDate = sumExpenseInRange(transactions, startCurr, endNow);
  const expensePreviousCalendarMonth = sumExpenseInRange(transactions, startPrev, endPrev);

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
    const projected =
      avgDailyExpenseCurrentMonth * daysInCurrentMonth || expenseCurrentMonthToDate;
    pctExpenseChangeVsPreviousFullMonth =
      Math.round(((projected - expensePreviousCalendarMonth) / expensePreviousCalendarMonth) * 1000) /
      10;
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
  const catShares: Record<string, number> = {};
  for (const tx of transactions) {
    if (tx.type !== 'expense' || tx.analysisExcluded) continue;
    const t = new Date(tx.transactionDate).getTime();
    if (t < startMs || t >= endMs) continue;
    const name =
      tx.categoryId && categoryMap[tx.categoryId] ? categoryMap[tx.categoryId] : 'Uncategorized';
    catShares[name] = (catShares[name] ?? 0) + tx.amount;
  }
  const shares = Object.values(catShares).map((a) => a / total);
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

export function buildFinanceAssistantToolSnapshot(
  transactions: TxForMetrics[],
  categoryMap: Record<string, string>,
  budgets: BudgetRow[],
  currencyHint: string,
  now: Date = new Date(),
): FinanceAssistantToolSnapshot {
  const rolling30 = buildInsightMetricSnapshot(transactions, categoryMap, currencyHint, now);
  const calendarMonth = buildCalendarMonthTrendSnapshot(transactions, currencyHint, now);
  const budgetCoach = buildBudgetCoachSnapshot(transactions, categoryMap, budgets, currencyHint, now);
  const spendingStory = buildSpendingStorySnapshot(transactions, categoryMap, currencyHint, now);

  return {
    schema: 'finance_assistant_tool_v1',
    generatedAt: now.toISOString(),
    rolling30,
    calendarMonth,
    budgetCoach,
    spendingStory,
  };
}
