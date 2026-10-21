import type { CurrencyCode } from '@repo/types';

import { toLocalDateInput } from '@/lib/dates/local-date-input';
import { transactionDeltaMinor } from '@/lib/finance/ledger';
import type { FinanceTransaction, FinanceWallet } from '@/lib/finance/types';

/** One chart column: a local day of this month, from the 1st to today. */
export type MonthDay<V extends string> = { key: string; day: number } & Record<V, number>;

export type SpendingMonth = {
  days: MonthDay<'spentMinor'>[];
  daysInMonth: number;
  spentMinor: number;
  inMinor: number;
  /** Spent last month from the 1st to the same day number. */
  lastMonthByNowMinor: number;
  /** Main-currency budgets ÷ days in the month; null without a budget. */
  evenPaceMinor: number | null;
  /** What the budgets leave ÷ days left, today included; null without a budget. */
  safeToSpendMinor: number | null;
};

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

export function spendingMonth(
  transactions: readonly FinanceTransaction[],
  budgetMinor: number | null,
  currency: CurrencyCode,
  now: Date,
): SpendingMonth {
  const year = now.getFullYear();
  const month = now.getMonth();
  const daysInMonth = daysIn(year, month);
  const lastMonthEnd = new Date(year, month - 1, Math.min(now.getDate(), daysIn(year, month - 1)));
  const lastMonthKey = toLocalDateInput(lastMonthEnd);
  const lastMonthStart = toLocalDateInput(new Date(year, month - 1, 1));
  const days = monthDays(now).map((day) => ({ ...day, spentMinor: 0 }));
  const byKey = new Map(days.map((day) => [day.key, day]));
  let inMinor = 0;
  let lastMonthByNowMinor = 0;
  for (const transaction of transactions) {
    const key = toLocalDateInput(new Date(transaction.transactionDate));
    if (
      transaction.type === 'income' &&
      transaction.currency === currency &&
      !transaction.analysisExcluded &&
      !transaction.debtActivityId &&
      byKey.has(key)
    )
      inMinor += Number(transaction.amountMinor);
    if (!isSpending(transaction, currency)) continue;
    const day = byKey.get(key);
    if (day) day.spentMinor += Number(transaction.amountMinor);
    else if (key >= lastMonthStart && key <= lastMonthKey)
      lastMonthByNowMinor += Number(transaction.amountMinor);
  }
  const spentMinor = days.reduce((sum, day) => sum + day.spentMinor, 0);
  const budgeted = budgetMinor !== null && budgetMinor > 0;
  const daysLeft = daysInMonth - now.getDate() + 1;
  return {
    days,
    daysInMonth,
    spentMinor,
    inMinor,
    lastMonthByNowMinor,
    evenPaceMinor: budgeted ? Math.floor(budgetMinor / daysInMonth) : null,
    safeToSpendMinor: budgeted
      ? Math.max(0, Math.floor((budgetMinor - spentMinor) / daysLeft))
      : null,
  };
}

/** Closing balance of the main-currency wallets on each day from the 1st to today. */
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
