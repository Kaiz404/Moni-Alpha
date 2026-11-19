/**
 * Deterministic finance metrics snapshot for chat analysis.
 */
import {
  addMinor,
  minorToNumber,
  type CalendarMonthTrendSnapshot,
  type FinanceAssistantCurrencySnapshot,
  type FinanceAssistantToolSnapshot,
  type FinanceFacts,
  type MinorAmount,
  type PendingProposalsSnapshot,
  type SpendingStorySnapshot,
} from '@repo/types';

import {
  addDays,
  dayOfMonth,
  daysInMonth,
  firstDayOf,
  shiftMonth,
  type Calendar,
} from '../calendar';
import { countsAsSpending } from '../ledger';
import { buildBudgetCoachSnapshot, type BudgetForMetrics } from './budget-coach-metrics';
import { buildInsightMetricSnapshot, type TxForMetrics } from './insight-metrics';

export type { BudgetForMetrics, TxForMetrics };

export type ProposalForMetrics = {
  amountMinor: MinorAmount | null;
  currency?: string | null;
  type: 'income' | 'expense' | 'transfer';
};

/** Average daily spend is too noisy to compare before this day of the month. */
export const PACE_MIN_DAY_OF_MONTH = 7;

/** Above this share of month-to-date spend, one bill (rent) would read as a fast daily pace. */
export const PACE_MAX_SINGLE_EXPENSE_SHARE = 0.5;

function sumExpenseInRange(
  txs: readonly TxForMetrics[],
  startMs: number,
  endMs: number,
): MinorAmount {
  let s = 0 as MinorAmount;
  for (const tx of txs) {
    if (!countsAsSpending(tx)) continue;
    const t = new Date(tx.transactionDate).getTime();
    if (t >= startMs && t <= endMs) s = addMinor(s, tx.amountMinor);
  }
  return s;
}

function largestExpenseInRange(
  txs: readonly TxForMetrics[],
  startMs: number,
  endMs: number,
): number {
  let largest = 0;
  for (const tx of txs) {
    if (!countsAsSpending(tx)) continue;
    const t = new Date(tx.transactionDate).getTime();
    if (t >= startMs && t <= endMs) largest = Math.max(largest, Number(tx.amountMinor));
  }
  return largest;
}

export function buildCalendarMonthTrendSnapshot(
  transactions: readonly TxForMetrics[],
  currencyHint: string,
  now: Date,
  calendar: Calendar,
): CalendarMonthTrendSnapshot {
  const currentMonthKey = calendar.monthKey(now);
  const previousMonthKey = shiftMonth(currentMonthKey, -1);

  const startCurr = calendar.startOfDay(firstDayOf(currentMonthKey)).getTime();
  const endNow = now.getTime();
  const startPrev = calendar.startOfDay(firstDayOf(previousMonthKey)).getTime();
  const endPrev = startCurr - 1;

  const expenseCurrentMonthToDateMinor = sumExpenseInRange(transactions, startCurr, endNow);
  const expensePreviousCalendarMonthMinor = sumExpenseInRange(transactions, startPrev, endPrev);
  const expenseCurrentMonthToDate = minorToNumber(expenseCurrentMonthToDateMinor);
  const expensePreviousCalendarMonth = minorToNumber(expensePreviousCalendarMonthMinor);

  const dayOfMonthNow = dayOfMonth(calendar.dayKey(now));
  const daysInCurrentMonth = daysInMonth(currentMonthKey);

  const avgDailyExpenseCurrentMonth =
    dayOfMonthNow > 0 ? Math.round((expenseCurrentMonthToDate / dayOfMonthNow) * 100) / 100 : 0;
  const daysInPrevMonth = daysInMonth(previousMonthKey);
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
  transactions: readonly TxForMetrics[],
  categoryMap: Record<string, string>,
  currencyHint: string,
  now: Date,
  calendar: Calendar,
): SpendingStorySnapshot {
  const rolling = buildInsightMetricSnapshot(
    transactions,
    categoryMap,
    currencyHint,
    now,
    calendar,
  );
  const total = rolling.current.expenseTotal || 1;
  const topCategories = rolling.topCategories.slice(0, 5).map((c) => ({
    ...c,
    sharePct: Math.round((c.amount / total) * 1000) / 10,
  }));
  const topMerchants = rolling.topMerchants.slice(0, 5).map((m) => ({
    ...m,
    sharePct: Math.round((m.amount / total) * 1000) / 10,
  }));
  const endMs = calendar.startOfDay(addDays(calendar.dayKey(now), 1)).getTime();
  const startMs = endMs - 30 * 86400000;
  const catShares: Record<string, MinorAmount> = {};
  for (const tx of transactions) {
    if (!countsAsSpending(tx)) continue;
    const t = new Date(tx.transactionDate).getTime();
    if (t < startMs || t >= endMs) continue;
    const name = (tx.categoryId && categoryMap[tx.categoryId]) || 'Uncategorized';
    catShares[name] = addMinor(catShares[name] ?? 0, tx.amountMinor);
  }
  const shares = Object.values(catShares).map((amountMinor) => minorToNumber(amountMinor) / total);
  const hhi = shares.reduce((s, p) => s + p * p, 0);

  let expenseTx = 0;
  for (const tx of transactions) {
    if (!countsAsSpending(tx)) continue;
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
  proposals: readonly ProposalForMetrics[],
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

/** What the chat snapshot reads: the user's rows, already filtered to the user. */
export type FinanceSnapshotInput = {
  transactions: readonly TxForMetrics[];
  /** Category id to name, for the user's and the preset categories. */
  categoryNames: Record<string, string>;
  budgets: readonly BudgetForMetrics[];
  proposals?: readonly ProposalForMetrics[];
  /** One facts block per currency (`buildFinanceFactsByCurrency`). */
  facts?: Record<string, FinanceFacts>;
  now: Date;
  calendar: Calendar;
};

function buildFinanceAssistantCurrencySnapshot(
  transactions: readonly TxForMetrics[],
  categoryMap: Record<string, string>,
  budgets: readonly BudgetForMetrics[],
  proposals: readonly ProposalForMetrics[],
  facts: FinanceFacts | undefined,
  currencyHint: string,
  now: Date,
  calendar: Calendar,
): FinanceAssistantCurrencySnapshot {
  const rolling30 = buildInsightMetricSnapshot(
    transactions,
    categoryMap,
    currencyHint,
    now,
    calendar,
  );
  const calendarMonth = buildCalendarMonthTrendSnapshot(transactions, currencyHint, now, calendar);
  const budgetCoach = buildBudgetCoachSnapshot(
    transactions,
    categoryMap,
    budgets,
    currencyHint,
    now,
    calendar,
  );
  const spendingStory = buildSpendingStorySnapshot(
    transactions,
    categoryMap,
    currencyHint,
    now,
    calendar,
  );

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
function withCurrency<T extends { currency?: string | null }>(
  rows: readonly T[],
  label: string,
): T[] {
  const kept = rows.filter((row) => currencyOf(row) !== null);
  if (kept.length < rows.length) {
    console.warn(
      `[finance-metrics] skipped ${rows.length - kept.length} ${label} without currency`,
    );
  }
  return kept;
}

export function buildFinanceAssistantToolSnapshotByCurrency({
  transactions,
  categoryNames,
  budgets,
  proposals = [],
  facts = {},
  now,
  calendar,
}: FinanceSnapshotInput): FinanceAssistantToolSnapshot {
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
        categoryNames,
        budgets.filter((budget) => currencyOf(budget) === currency),
        pending.filter((proposal) => currencyOf(proposal) === currency),
        facts[currency],
        currency,
        now,
        calendar,
      ),
    ]),
  );
  return {
    schema: 'finance_assistant_tool_v4',
    generatedAt: now.toISOString(),
    currencies: snapshots,
  };
}
