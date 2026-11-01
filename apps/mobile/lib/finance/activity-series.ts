import type { CurrencyCode } from '@repo/types';

import { toLocalDateInput } from '@/lib/dates/local-date-input';
import { transactionDeltaMinor } from '@/lib/finance/ledger';
import type { FinanceTransaction, FinanceWallet } from '@/lib/finance/types';

export type MonthDay<V extends string> = { key: string; day: number } & Record<V, number>;

export type BalanceMonth = {
  days: MonthDay<'balanceMinor'>[];
  daysInMonth: number;
};

function daysIn(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function monthDays(now: Date): { key: string; day: number }[] {
  return Array.from({ length: now.getDate() }, (_, index) => ({
    key: toLocalDateInput(new Date(now.getFullYear(), now.getMonth(), index + 1)),
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
    const i = index.get(toLocalDateInput(new Date(transaction.transactionDate)));
    if (i === undefined) continue;
    const row = (daily[transaction.categoryId] ??= days.map(() => 0));
    row[i] += Number(transaction.amountMinor);
  }
  for (const row of Object.values(daily))
    for (let i = 1; i < row.length; i++) row[i] += row[i - 1];
  return daily;
}

export function balanceMonth(
  wallets: readonly FinanceWallet[],
  transactions: readonly FinanceTransaction[],
  currency: CurrencyCode,
  now: Date,
): BalanceMonth {
  const ids = wallets.filter((wallet) => wallet.currency === currency).map((wallet) => wallet.id);
  const days = monthDays(now);
  const deltaByKey = new Map<string, number>();
  let opening = 0;
  for (const wallet of wallets)
    if (wallet.currency === currency) opening += Number(wallet.initialBalanceMinor);
  for (const transaction of transactions) {
    const delta = ids.reduce(
      (sum, id) => sum + Number(transactionDeltaMinor(transaction, id)),
      0,
    );
    if (delta === 0) continue;
    const key = toLocalDateInput(new Date(transaction.transactionDate));
    if (key < days[0].key) opening += delta;
    else deltaByKey.set(key, (deltaByKey.get(key) ?? 0) + delta);
  }
  let running = opening;
  return {
    days: days.map((day) => {
      running += deltaByKey.get(day.key) ?? 0;
      return { ...day, balanceMinor: running };
    }),
    daysInMonth: daysIn(now.getFullYear(), now.getMonth()),
  };
}
