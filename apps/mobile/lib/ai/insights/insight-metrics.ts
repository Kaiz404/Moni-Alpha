/** Deterministic finance metrics for AI insight cards. The LLM only narrates this snapshot. */
import { addMinor, minorToNumber, subtractMinor, type MinorAmount } from '@repo/types';

export type TxForMetrics = {
  amountMinor: MinorAmount;
  currency?: string | null;
  analysisExcluded?: boolean;
  type: 'income' | 'expense' | 'transfer';
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

function sumByType(txs: TxForMetrics[], type: TxForMetrics['type'], startMs: number, endMs: number): MinorAmount {
  return addMinor(...txs.filter((tx) => !tx.analysisExcluded && tx.type === type && inRange(tx.transactionDate, startMs, endMs)).map((tx) => tx.amountMinor));
}

function countInRange(txs: TxForMetrics[], startMs: number, endMs: number): number {
  return txs.filter((tx) => tx.type !== 'transfer' && !tx.analysisExcluded && inRange(tx.transactionDate, startMs, endMs)).length;
}

function groupExpenseBy(txs: TxForMetrics[], startMs: number, endMs: number, keyFn: (tx: TxForMetrics) => string): Record<string, MinorAmount> {
  const totals: Record<string, MinorAmount> = {};
  for (const tx of txs) {
    if (tx.type !== 'expense' || tx.analysisExcluded || !inRange(tx.transactionDate, startMs, endMs)) continue;
    const key = keyFn(tx);
    totals[key] = addMinor(totals[key] ?? zero, tx.amountMinor);
  }
  return totals;
}

function topEntries(map: Record<string, MinorAmount>, limit: number): { name: string; amount: number }[] {
  return Object.entries(map)
    .map(([name, amountMinor]) => ({ name, amount: minorToNumber(amountMinor) }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, limit);
}

function largestExpense(txs: TxForMetrics[], categoryMap: Record<string, string>, startMs: number, endMs: number): { amount: number; merchant: string | null; category: string | null; date: string } | null {
  let best: TxForMetrics | null = null;
  for (const tx of txs) {
    if (tx.type !== 'expense' || tx.analysisExcluded || !inRange(tx.transactionDate, startMs, endMs)) continue;
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
  if (prior <= 0) return current <= 0 ? null : 100;
  return Math.round(((Number(current) - Number(prior)) / Number(prior)) * 1000) / 10;
}

export type InsightMetricSnapshot = {
  periodDays: typeof PERIOD_DAYS;
  currencyHint: string;
  generatedAt: string;
  current: { startIso: string; endIso: string; expenseTotal: number; incomeTotal: number; net: number; transactionCount: number };
  prior: { startIso: string; endIso: string; expenseTotal: number; incomeTotal: number; net: number; transactionCount: number };
  topCategories: { name: string; amount: number }[];
  topMerchants: { name: string; amount: number }[];
  largestExpense: { amount: number; merchant: string | null; category: string | null; date: string } | null;
  deltas: { expensePctVsPrior: number | null; incomePctVsPrior: number | null };
  rates: { dailyExpense: number; savingsMargin: number | null };
};

export function buildInsightMetricSnapshot(transactions: TxForMetrics[], categoryMap: Record<string, string>, currencyHint: string, now: Date = new Date()): InsightMetricSnapshot {
  const endMs = startOfDayMs(now) + 86400000;
  const currentStartMs = endMs - PERIOD_DAYS * 86400000;
  const priorStartMs = currentStartMs - PERIOD_DAYS * 86400000;
  const curExp = sumByType(transactions, 'expense', currentStartMs, endMs);
  const curInc = sumByType(transactions, 'income', currentStartMs, endMs);
  const priorExp = sumByType(transactions, 'expense', priorStartMs, currentStartMs);
  const priorInc = sumByType(transactions, 'income', priorStartMs, currentStartMs);
  const categories = groupExpenseBy(transactions, currentStartMs, endMs, (tx) => tx.categoryId && categoryMap[tx.categoryId] ? categoryMap[tx.categoryId] : 'Uncategorized');
  const merchants = groupExpenseBy(transactions, currentStartMs, endMs, (tx) => tx.merchant?.trim() || 'Unknown merchant');
  const savingsMargin = curInc > 0 ? Math.round(((Number(curInc) - Number(curExp)) / Number(curInc)) * 1000) / 10 : null;

  return {
    periodDays: PERIOD_DAYS,
    currencyHint: currencyHint || 'USD',
    generatedAt: now.toISOString(),
    current: { startIso: new Date(currentStartMs).toISOString(), endIso: new Date(endMs - 1).toISOString(), expenseTotal: minorToNumber(curExp), incomeTotal: minorToNumber(curInc), net: minorToNumber(subtractMinor(curInc, curExp)), transactionCount: countInRange(transactions, currentStartMs, endMs) },
    prior: { startIso: new Date(priorStartMs).toISOString(), endIso: new Date(currentStartMs - 1).toISOString(), expenseTotal: minorToNumber(priorExp), incomeTotal: minorToNumber(priorInc), net: minorToNumber(subtractMinor(priorInc, priorExp)), transactionCount: countInRange(transactions, priorStartMs, currentStartMs) },
    topCategories: topEntries(categories, 5),
    topMerchants: topEntries(merchants, 5),
    largestExpense: largestExpense(transactions, categoryMap, currentStartMs, endMs),
    deltas: { expensePctVsPrior: pctDelta(curExp, priorExp), incomePctVsPrior: pctDelta(curInc, priorInc) },
    rates: { dailyExpense: Math.round((minorToNumber(curExp) / PERIOD_DAYS) * 100) / 100, savingsMargin },
  };
}

export function stableSnapshotString(snapshot: InsightMetricSnapshot): string {
  return JSON.stringify(snapshot);
}
