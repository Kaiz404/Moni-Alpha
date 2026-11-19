/** Deterministic rolling-window metrics for the chat snapshot. The LLM only narrates them. */
import { countsAsCashFlow, countsAsIncome, countsAsSpending, type LedgerTransaction } from '@repo/core';
import {
  addMinor,
  minorToNumber,
  subtractMinor,
  type InsightMetricSnapshot,
  type MinorAmount,
} from '@repo/types';

export type TxForMetrics = LedgerTransaction & {
  amountMinor: MinorAmount;
  currency?: string | null;
  categoryId?: string | null;
  merchant?: string | null;
  transactionDate: string;
};

const PERIOD_DAYS = 30;
const zero = 0 as MinorAmount;

function startOfDayMs(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function inRange(isoDate: string, startMs: number, endMs: number): boolean {
  const time = new Date(isoDate).getTime();
  return time >= startMs && time < endMs;
}

function sumInRange(
  txs: TxForMetrics[],
  counts: (tx: TxForMetrics) => boolean,
  startMs: number,
  endMs: number,
): MinorAmount {
  return addMinor(
    ...txs
      .filter((tx) => counts(tx) && inRange(tx.transactionDate, startMs, endMs))
      .map((tx) => tx.amountMinor),
  );
}

function countInRange(txs: TxForMetrics[], startMs: number, endMs: number): number {
  return txs.filter((tx) => countsAsCashFlow(tx) && inRange(tx.transactionDate, startMs, endMs))
    .length;
}

function groupExpenseBy(
  txs: TxForMetrics[],
  startMs: number,
  endMs: number,
  keyFn: (tx: TxForMetrics) => string,
): Record<string, MinorAmount> {
  const totals: Record<string, MinorAmount> = {};
  for (const tx of txs) {
    if (!countsAsSpending(tx) || !inRange(tx.transactionDate, startMs, endMs)) continue;
    const key = keyFn(tx);
    totals[key] = addMinor(totals[key] ?? zero, tx.amountMinor);
  }
  return totals;
}

function topEntries(
  map: Record<string, MinorAmount>,
  limit: number,
): { name: string; amount: number }[] {
  return Object.entries(map)
    .map(([name, amountMinor]) => ({
      name,
      amount: minorToNumber(amountMinor),
    }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, limit);
}

function largestExpense(
  txs: TxForMetrics[],
  categoryMap: Record<string, string>,
  startMs: number,
  endMs: number,
): {
  amount: number;
  merchant: string | null;
  category: string | null;
  date: string;
} | null {
  let best: TxForMetrics | null = null;
  for (const tx of txs) {
    if (!countsAsSpending(tx) || !inRange(tx.transactionDate, startMs, endMs)) continue;
    if (!best || tx.amountMinor > best.amountMinor) best = tx;
  }
  if (!best) return null;
  return {
    amount: minorToNumber(best.amountMinor),
    merchant: best.merchant?.trim() || null,
    category: best.categoryId && categoryMap[best.categoryId] ? categoryMap[best.categoryId] : null,
    date: best.transactionDate,
  };
}

function pctDelta(current: MinorAmount, prior: MinorAmount): number | null {
  if (prior <= 0) return null;
  return Math.round(((Number(current) - Number(prior)) / Number(prior)) * 1000) / 10;
}

export function buildInsightMetricSnapshot(
  transactions: TxForMetrics[],
  categoryMap: Record<string, string>,
  currencyHint: string,
  now: Date = new Date(),
): InsightMetricSnapshot {
  const endMs = startOfDayMs(now) + 86400000;
  const currentStartMs = endMs - PERIOD_DAYS * 86400000;
  const priorStartMs = currentStartMs - PERIOD_DAYS * 86400000;
  const curExp = sumInRange(transactions, countsAsSpending, currentStartMs, endMs);
  const curInc = sumInRange(transactions, countsAsIncome, currentStartMs, endMs);
  const priorExp = sumInRange(transactions, countsAsSpending, priorStartMs, currentStartMs);
  const priorInc = sumInRange(transactions, countsAsIncome, priorStartMs, currentStartMs);
  const categories = groupExpenseBy(transactions, currentStartMs, endMs, (tx) =>
    tx.categoryId && categoryMap[tx.categoryId] ? categoryMap[tx.categoryId] : 'Uncategorized',
  );
  const merchants = groupExpenseBy(
    transactions,
    currentStartMs,
    endMs,
    (tx) => tx.merchant?.trim() || 'Unknown merchant',
  );
  const savingsMargin =
    curInc > 0
      ? Math.round(((Number(curInc) - Number(curExp)) / Number(curInc)) * 1000) / 10
      : null;

  return {
    periodDays: PERIOD_DAYS,
    currencyHint,
    generatedAt: now.toISOString(),
    current: {
      startIso: new Date(currentStartMs).toISOString(),
      endIso: new Date(endMs - 1).toISOString(),
      expenseTotal: minorToNumber(curExp),
      incomeTotal: minorToNumber(curInc),
      net: minorToNumber(subtractMinor(curInc, curExp)),
      transactionCount: countInRange(transactions, currentStartMs, endMs),
    },
    prior: {
      startIso: new Date(priorStartMs).toISOString(),
      endIso: new Date(currentStartMs - 1).toISOString(),
      expenseTotal: minorToNumber(priorExp),
      incomeTotal: minorToNumber(priorInc),
      net: minorToNumber(subtractMinor(priorInc, priorExp)),
      transactionCount: countInRange(transactions, priorStartMs, currentStartMs),
    },
    topCategories: topEntries(categories, 5),
    topMerchants: topEntries(merchants, 5),
    largestExpense: largestExpense(transactions, categoryMap, currentStartMs, endMs),
    deltas: {
      expensePctVsPrior: pctDelta(curExp, priorExp),
      incomePctVsPrior: pctDelta(curInc, priorInc),
    },
    rates: {
      dailyExpense: Math.round((minorToNumber(curExp) / PERIOD_DAYS) * 100) / 100,
      savingsMargin,
    },
  };
}
