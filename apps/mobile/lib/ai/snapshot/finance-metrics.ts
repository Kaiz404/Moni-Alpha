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
import type { FinanceFacts } from '../facts';

export type { BudgetRow, TxForMetrics };

export type ProposalForMetrics = {
  amountMinor: MinorAmount | null;
  currency?: string | null;
  type: 'income' | 'expense' | 'transfer';
};

/** Logged but not yet reviewed, so absent from every other total. */
export type PendingProposalsSnapshot = {
  count: number;
  expenseTotal: number;
  incomeTotal: number;
};

/** Average daily spend is too noisy to compare before this day of the month. */
export const PACE_MIN_DAY_OF_MONTH = 7;

/** Above this share of month-to-date spend, one bill (rent) would read as a fast daily pace. */
export const PACE_MAX_SINGLE_EXPENSE_SHARE = 0.5;

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
  /** Average daily spend so far vs last month's. Not a forecast; null before day 7 or when one bill dominates. */
  dailyPaceVsPreviousMonthPct: number | null;
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
  pendingProposals: PendingProposalsSnapshot;
  /** Balances, recurring series, payday and forecast; absent when the caller has no ledger facts. */
  facts?: FinanceFacts;
};

/** Chat payload: every metric is scoped to exactly one currency. */
export type FinanceAssistantToolSnapshot = {
  schema: 'finance_assistant_tool_v4';
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

function largestExpenseInRange(txs: TxForMetrics[], startMs: number, endMs: number): number {
  let largest = 0;
  for (const tx of txs) {
    if (tx.type !== 'expense' || tx.analysisExcluded) continue;
    const t = new Date(tx.transactionDate).getTime();
    if (t >= startMs && t <= endMs) largest = Math.max(largest, Number(tx.amountMinor));
  }
  return largest;
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

  const oneBillDominates =
    largestExpenseInRange(transactions, startCurr, endNow) >
    Number(expenseCurrentMonthToDateMinor) * PACE_MAX_SINGLE_EXPENSE_SHARE;
  const dailyPaceVsPreviousMonthPct =
    dayOfMonthNow >= PACE_MIN_DAY_OF_MONTH &&
    expensePreviousCalendarMonthMinor > 0 &&
    !oneBillDominates
      ? Math.round(
          ((Number(expenseCurrentMonthToDateMinor) * daysInPrevMonth) /
            (Number(expensePreviousCalendarMonthMinor) * dayOfMonthNow) -
            1) *
            1000,
        ) / 10
      : null;

  return {
    currencyHint,
    currentMonthKey,
    previousMonthKey,
    expenseCurrentMonthToDate,
    expensePreviousCalendarMonth,
    dayOfMonthNow,
    daysInCurrentMonth,
    avgDailyExpenseCurrentMonth,
    avgDailyExpensePreviousMonth,
    dailyPaceVsPreviousMonthPct,
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
    currencyHint,
    periodLabel: `last ${rolling.periodDays} days`,
    topCategories,
    topMerchants,
    categoryConcentration: Math.round(hhi * 1000) / 1000,
    expenseTransactionCount: expenseTx,
  };
}

export function buildPendingProposalsSnapshot(
  proposals: ProposalForMetrics[],
): PendingProposalsSnapshot {
  let expense = 0 as MinorAmount;
  let income = 0 as MinorAmount;
  for (const proposal of proposals) {
    if (proposal.amountMinor === null) continue;
    if (proposal.type === 'expense') expense = addMinor(expense, proposal.amountMinor);
    if (proposal.type === 'income') income = addMinor(income, proposal.amountMinor);
  }
  return {
    count: proposals.length,
    expenseTotal: minorToNumber(expense),
    incomeTotal: minorToNumber(income),
  };
}

function buildFinanceAssistantCurrencySnapshot(
  transactions: TxForMetrics[],
  categoryMap: Record<string, string>,
  budgets: BudgetRow[],
  proposals: ProposalForMetrics[],
  facts: FinanceFacts | undefined,
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
    pendingProposals: buildPendingProposalsSnapshot(proposals),
    ...(facts ? { facts } : {}),
  };
}

function currencyOf(row: { currency?: string | null }): string | null {
  return row.currency?.trim().toUpperCase() || null;
}

/** Rows without a currency are dropped: guessing one would file the money under the wrong key. */
function withCurrency<T extends { currency?: string | null }>(rows: T[], label: string): T[] {
  const kept = rows.filter((row) => currencyOf(row) !== null);
  if (kept.length < rows.length) {
    console.warn(
      `[finance-metrics] skipped ${rows.length - kept.length} ${label} without currency`,
    );
  }
  return kept;
}

export function buildFinanceAssistantToolSnapshotByCurrency(
  transactions: TxForMetrics[],
  categoryMap: Record<string, string>,
  budgets: BudgetRow[],
  proposals: ProposalForMetrics[] = [],
  now: Date = new Date(),
  facts: Record<string, FinanceFacts> = {},
): FinanceAssistantToolSnapshot {
  const txs = withCurrency(transactions, 'transactions');
  const pending = withCurrency(proposals, 'pending proposals');
  const currencies = new Set(
    [...txs, ...budgets, ...pending]
      .map(currencyOf)
      .filter((c): c is string => c !== null)
      .concat(Object.keys(facts)),
  );
  const snapshots = Object.fromEntries(
    [...currencies].sort().map((currency) => [
      currency,
      buildFinanceAssistantCurrencySnapshot(
        txs.filter((transaction) => currencyOf(transaction) === currency),
        categoryMap,
        budgets.filter((budget) => currencyOf(budget) === currency),
        pending.filter((proposal) => currencyOf(proposal) === currency),
        facts[currency],
        currency,
        now,
      ),
    ]),
  );
  return {
    schema: 'finance_assistant_tool_v4',
    generatedAt: now.toISOString(),
    currencies: snapshots,
  };
}
