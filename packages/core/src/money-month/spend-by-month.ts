import type { CurrencyCode, MinorAmount } from '@repo/types';

import { type Calendar, type MonthKey, shiftMonth } from '../calendar';
import { countsAsSpending } from '../ledger';
import type { FinanceTransaction } from '../read-model/types';

/** Spending by category over the months up to one month, in one currency. */
export type SpendByMonth = {
  /** Oldest first; the last is the month asked for. */
  months: MonthKey[];
  /** Each category's spend per month, in `months` order. Spending with no category is under `null`. */
  byCategory: Map<string | null, MinorAmount[]>;
  /** Everything spent per month, in `months` order. */
  totals: MinorAmount[];
  /** The first month with any spending in this currency, at any time; null when there is none. */
  firstMonth: MonthKey | null;
};

export function spendByMonth(
  transactions: readonly FinanceTransaction[],
  { month, count, currency, calendar }: { month: MonthKey; count: number; currency: CurrencyCode; calendar: Calendar },
): SpendByMonth {
  const months = Array.from({ length: count }, (_, index) => shiftMonth(month, index - count + 1));
  const slot = new Map(months.map((key, index) => [key, index]));
  const byCategory = new Map<string | null, MinorAmount[]>();
  const totals = months.map(() => 0);
  let firstMonth: MonthKey | null = null;
  for (const transaction of transactions) {
    if (transaction.currency !== currency || !countsAsSpending(transaction)) continue;
    const key = calendar.monthKey(transaction.transactionDate);
    if (firstMonth === null || key < firstMonth) firstMonth = key;
    const index = slot.get(key);
    if (index === undefined) continue;
    const amount = Number(transaction.amountMinor);
    totals[index]! += amount;
    const row = byCategory.get(transaction.categoryId) ?? months.map(() => 0 as MinorAmount);
    row[index] = (row[index]! + amount) as MinorAmount;
    byCategory.set(transaction.categoryId, row);
  }
  return { months, byCategory, totals: totals as MinorAmount[], firstMonth };
}

/**
 * What a row spent the month before the history's last, and its average over the three months
 * before it. Months before the user's first spending don't count toward the average; with none of
 * the three counted it is null.
 */
export function lastMonthAndAverage(
  history: SpendByMonth,
  row: readonly MinorAmount[],
): { lastMonthMinor: MinorAmount; averageMinor: MinorAmount | null } {
  const end = history.months.length - 1;
  const counted = [end - 1, end - 2, end - 3].filter(
    (index) => index >= 0 && history.firstMonth !== null && history.months[index]! >= history.firstMonth,
  );
  const sum = counted.reduce((total, index) => total + Number(row[index] ?? 0), 0);
  return {
    lastMonthMinor: (row[end - 1] ?? 0) as MinorAmount,
    averageMinor: counted.length ? (Math.round(sum / counted.length) as MinorAmount) : null,
  };
}
