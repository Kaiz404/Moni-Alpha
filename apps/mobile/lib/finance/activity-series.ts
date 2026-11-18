import type { CurrencyCode } from '@repo/types';

import type { FinanceTransaction } from '@/lib/finance/types';
import { deviceCalendar } from '@/lib/dates/device-calendar';
import { addDays, dayOfMonth, firstDayOf, monthOf } from '@repo/core';

export type MonthDay<V extends string> = { key: string; day: number } & Record<V, number>;

function monthDays(now: Date): { key: string; day: number }[] {
  const today = deviceCalendar.dayKey(now);
  const first = firstDayOf(monthOf(today));
  return Array.from({ length: dayOfMonth(today) }, (_, index) => ({
    key: addDays(first, index),
    day: index + 1,
  }));
}

/** Spending leaves out transfers, balance corrections and debt cash. */
function isSpending(transaction: FinanceTransaction, currency: CurrencyCode): boolean {
  return (
    transaction.type === 'expense' &&
    transaction.currency === currency &&
    !transaction.analysisExcluded &&
    !transaction.debtActivityId
  );
}

/**
 * Running total per category from the 1st to today, in one currency: spending for
 * expense categories, money in for income ones. Same exclusions as Activity's day totals.
 */
export function categoryMonths(
  transactions: readonly FinanceTransaction[],
  currency: CurrencyCode,
  now: Date,
): Record<string, number[]> {
  const days = monthDays(now);
  const index = new Map(days.map((day, i) => [day.key, i]));
  const daily: Record<string, number[]> = {};
  for (const transaction of transactions) {
    if (
      !transaction.categoryId ||
      transaction.type === 'transfer' ||
      transaction.currency !== currency ||
      transaction.analysisExcluded ||
      transaction.debtActivityId
    )
      continue;
    const i = index.get(deviceCalendar.dayKey(transaction.transactionDate));
    if (i === undefined) continue;
    const row = (daily[transaction.categoryId] ??= days.map(() => 0));
    row[i] += Number(transaction.amountMinor);
  }
  for (const row of Object.values(daily))
    for (let i = 1; i < row.length; i++) row[i] += row[i - 1];
  return daily;
}
