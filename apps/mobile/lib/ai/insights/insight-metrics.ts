/**
 * Deterministic finance metrics for AI insight cards.
 * All numbers are computed in code — the LLM only narrates this snapshot.
 */

export type TxForMetrics = {
  amount: number;
  type: 'income' | 'expense' | 'transfer';
  categoryId?: string | null;
  merchant?: string | null;
  transactionDate: string;
};

const PERIOD_DAYS = 30;

function startOfDayMs(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function inRange(isoDate: string, startMs: number, endMs: number): boolean {
  const t = new Date(isoDate).getTime();
  return t >= startMs && t < endMs;
}

function sumByType(
  txs: TxForMetrics[],
  type: TxForMetrics['type'],
  startMs: number,
  endMs: number,
): number {
  let s = 0;
  for (const tx of txs) {
    if (tx.type !== type) continue;
    if (!inRange(tx.transactionDate, startMs, endMs)) continue;
    s += tx.amount;
  }
  return Math.round(s * 100) / 100;
}

function countInRange(txs: TxForMetrics[], startMs: number, endMs: number): number {
  let n = 0;
  for (const tx of txs) {
    if (tx.type === 'transfer') continue;
    if (!inRange(tx.transactionDate, startMs, endMs)) continue;
    n += 1;
  }
  return n;
}

function groupExpenseBy(
  txs: TxForMetrics[],
  startMs: number,
  endMs: number,
  keyFn: (tx: TxForMetrics) => string,
): Record<string, number> {
  const acc: Record<string, number> = {};
  for (const tx of txs) {
    if (tx.type !== 'expense') continue;
    if (!inRange(tx.transactionDate, startMs, endMs)) continue;
    const k = keyFn(tx);
    acc[k] = (acc[k] ?? 0) + tx.amount;
  }
  return acc;
}

function topEntries(map: Record<string, number>, n: number): { name: string; amount: number }[] {
  return Object.entries(map)
    .map(([name, amount]) => ({ name, amount: Math.round(amount * 100) / 100 }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, n);
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
    if (tx.type !== 'expense') continue;
    if (!inRange(tx.transactionDate, startMs, endMs)) continue;
    if (!best || tx.amount > best.amount) best = tx;
  }
  if (!best) return null;
  const cat =
    best.categoryId && categoryMap[best.categoryId] ? categoryMap[best.categoryId] : null;
  return {
    amount: Math.round(best.amount * 100) / 100,
    merchant: best.merchant?.trim() || null,
    category: cat,
    date: best.transactionDate,
  };
}

function pctDelta(current: number, prior: number): number | null {
  if (prior <= 0) {
    if (current <= 0) return null;
    return 100;
  }
  return Math.round(((current - prior) / prior) * 1000) / 10;
}

export type InsightMetricSnapshot = {
  periodDays: typeof PERIOD_DAYS;
  currencyHint: string;
  generatedAt: string;
  current: {
    startIso: string;
    endIso: string;
    expenseTotal: number;
    incomeTotal: number;
    net: number;
    transactionCount: number;
  };
  prior: {
    startIso: string;
    endIso: string;
    expenseTotal: number;
    incomeTotal: number;
    net: number;
    transactionCount: number;
  };
  topCategories: { name: string; amount: number }[];
  topMerchants: { name: string; amount: number }[];
  largestExpense: {
    amount: number;
    merchant: string | null;
    category: string | null;
    date: string;
  } | null;
  deltas: {
    expensePctVsPrior: number | null;
    incomePctVsPrior: number | null;
  };
  rates: {
    dailyExpense: number;
    savingsMargin: number | null;
  };
};

export function buildInsightMetricSnapshot(
  transactions: TxForMetrics[],
  categoryMap: Record<string, string>,
  currencyHint: string,
  now: Date = new Date(),
): InsightMetricSnapshot {
  const endMs = startOfDayMs(now) + 86400000;
  const currentStartMs = endMs - PERIOD_DAYS * 86400000;
  const priorStartMs = currentStartMs - PERIOD_DAYS * 86400000;

  const curExp = sumByType(transactions, 'expense', currentStartMs, endMs);
  const curInc = sumByType(transactions, 'income', currentStartMs, endMs);
  const prExp = sumByType(transactions, 'expense', priorStartMs, currentStartMs);
  const prInc = sumByType(transactions, 'income', priorStartMs, currentStartMs);

  const catMap = groupExpenseBy(
    transactions,
    currentStartMs,
    endMs,
    (tx) =>
      tx.categoryId && categoryMap[tx.categoryId] ? categoryMap[tx.categoryId] : 'Uncategorized',
  );
  const merMap = groupExpenseBy(transactions, currentStartMs, endMs, (tx) => {
    const m = tx.merchant?.trim();
    return m && m.length ? m : 'Unknown merchant';
  });

  const largest = largestExpense(transactions, categoryMap, currentStartMs, endMs);
  const savingsMargin =
    curInc > 0 ? Math.round(((curInc - curExp) / curInc) * 1000) / 10 : null;

  return {
    periodDays: PERIOD_DAYS,
    currencyHint: currencyHint || 'USD',
    generatedAt: now.toISOString(),
    current: {
      startIso: new Date(currentStartMs).toISOString(),
      endIso: new Date(endMs - 1).toISOString(),
      expenseTotal: curExp,
      incomeTotal: curInc,
      net: Math.round((curInc - curExp) * 100) / 100,
      transactionCount: countInRange(transactions, currentStartMs, endMs),
    },
    prior: {
      startIso: new Date(priorStartMs).toISOString(),
      endIso: new Date(currentStartMs - 1).toISOString(),
      expenseTotal: prExp,
      incomeTotal: prInc,
      net: Math.round((prInc - prExp) * 100) / 100,
      transactionCount: countInRange(transactions, priorStartMs, currentStartMs),
    },
    topCategories: topEntries(catMap, 5),
    topMerchants: topEntries(merMap, 5),
    largestExpense: largest,
    deltas: {
      expensePctVsPrior: pctDelta(curExp, prExp),
      incomePctVsPrior: pctDelta(curInc, prInc),
    },
    rates: {
      dailyExpense: Math.round((curExp / PERIOD_DAYS) * 100) / 100,
      savingsMargin,
    },
  };
}

/** Stable stringify for hashing (sorted keys). */
export function stableSnapshotString(snapshot: InsightMetricSnapshot): string {
  return JSON.stringify(snapshot);
}
