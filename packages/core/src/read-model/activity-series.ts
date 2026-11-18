import type { CurrencyCode } from '@repo/types';

import { addDays, type Calendar, dayOfMonth, firstDayOf, monthOf } from '../calendar';
import { countsAsCashFlow } from '../ledger';
import type { FinanceTransaction } from './types';

export type MonthDay<V extends string> = { key: string; day: number } & Record<V, number>;

function monthDays(now: Date, calendar: Calendar): { key: string; day: number }[] {
  const today = calendar.dayKey(now);
  const first = firstDayOf(monthOf(today));
  return Array.from({ length: dayOfMonth(today) }, (_, index) => ({
    key: addDays(first, index),
    day: index + 1,
  }));
}

/**
 * Running total per category from the 1st to today, in one currency: spending for
 * expense categories, money in for income ones. Same exclusions as Activity's day totals.
 */
export function categoryMonths(
  transactions: readonly FinanceTransaction[],
  currency: CurrencyCode,
  now: Date,
  calendar: Calendar,
): Record<string, number[]> {
  const days = monthDays(now, calendar);
  const index = new Map(days.map((day, i) => [day.key, i]));
  const daily: Record<string, number[]> = {};
  for (const transaction of transactions) {
    if (
      !transaction.categoryId ||
      transaction.currency !== currency ||
      !countsAsCashFlow(transaction)
    )
      continue;
    const i = index.get(calendar.dayKey(transaction.transactionDate));
    if (i === undefined) continue;
    const row = (daily[transaction.categoryId] ??= days.map(() => 0));
    row[i]! += Number(transaction.amountMinor);
  }
  for (const row of Object.values(daily))
    for (let i = 1; i < row.length; i++) row[i]! += row[i - 1]!;
  return daily;
}
