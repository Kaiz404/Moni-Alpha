import type { UpcomingBill } from '@repo/types';

import { formatDate } from '@/lib/dates/day-label';
import { parseLocalDateInput } from '@/lib/dates/local-date-input';
import { formatMoney } from '@/lib/finance/format-money';
import type { FinanceBudget, FinanceDebt, FinanceTransaction } from '@/lib/finance/types';

/** A calendar month; `month` is 0 for January. */
export type CalendarMonth = { year: number; month: number };

export type DebtDue = { name: string; amountMinor: number };

/** This month in the main currency: what the spent card and the bills strip read. */
export type SpentSummary = {
  month: CalendarMonth;
  /** Spend per day, minor units, day 1 to today. */
  daily: number[];
  spentMinor: number;
  budgetMinor: number | null;
  /** Bills still due from today to month end. */
  bills: UpcomingBill[];
  billsMinor: number;
  /** Money the user owes a person by month end (D1: it comes off what's left). */
  debtsDue: DebtDue[];
  debtsMinor: number;
  /** Budget less spent, bills and debts due; null without a budget. */
  leftMinor: number | null;
  /** Today through month end. */
  daysLeft: number;
  /** Safe to spend a day; null without a budget or when nothing is left. */
  perDayMinor: number | null;
};

function localKey(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function selectSpentSummary({
  now,
  currency,
  transactions,
  budgets,
  bills,
  debts,
}: {
  now: Date;
  currency: string;
  transactions: readonly FinanceTransaction[];
  budgets: readonly FinanceBudget[];
  bills: readonly UpcomingBill[];
  debts: readonly { debt: FinanceDebt; balanceMinor: number }[];
}): SpentSummary {
  const month = { year: now.getFullYear(), month: now.getMonth() };
  const today = now.getDate();
  const length = new Date(month.year, month.month + 1, 0).getDate();
  const todayKey = localKey(now);
  const monthEndKey = localKey(new Date(month.year, month.month, length));

  const daily = Array.from({ length: today }, () => 0);
  for (const transaction of transactions) {
    if (
      transaction.type !== 'expense' ||
      transaction.analysisExcluded ||
      transaction.currency !== currency
    )
      continue;
    const date = new Date(transaction.transactionDate);
    if (date.getFullYear() !== month.year || date.getMonth() !== month.month) continue;
    const day = date.getDate();
    if (day > today) continue;
    daily[day - 1]! += Number(transaction.amountMinor);
  }
  const spentMinor = daily.reduce((sum, value) => sum + value, 0);

  const monthBudgets = budgets.filter((budget) => budget.currency === currency);
  const budgetMinor = monthBudgets.length
    ? monthBudgets.reduce((sum, budget) => sum + Number(budget.amountMinor), 0)
    : null;

  const dueBills = bills.filter(
    (bill) =>
      bill.status === 'due' &&
      bill.currency === currency &&
      bill.dueDate >= todayKey &&
      bill.dueDate <= monthEndKey,
  );
  const billsMinor = dueBills.reduce((sum, bill) => sum + Number(bill.amountMinor), 0);

  const debtsDue = debts
    .filter(
      ({ debt, balanceMinor }) =>
        debt.direction === 'i_owe' &&
        debt.status === 'open' &&
        debt.currency === currency &&
        balanceMinor > 0 &&
        debt.dueDate !== null &&
        debt.dueDate <= monthEndKey,
    )
    .map(({ debt, balanceMinor }) => ({
      name: debt.counterpartyName,
      amountMinor: Number(balanceMinor),
    }));
  const debtsMinor = debtsDue.reduce((sum, debt) => sum + debt.amountMinor, 0);

  const daysLeft = length - today + 1;
  const leftMinor =
    budgetMinor === null ? null : budgetMinor - spentMinor - billsMinor - debtsMinor;
  const perDayMinor =
    leftMinor === null || leftMinor <= 0 ? null : Math.floor(leftMinor / daysLeft);

  return {
    month,
    daily,
    spentMinor,
    budgetMinor,
    bills: dueBills,
    billsMinor,
    debtsDue,
    debtsMinor,
    leftMinor,
    daysLeft,
    perDayMinor,
  };
}

/** "RM40 to Mei", or "RM60 to 2 people". */
export function debtPhrase(debtsDue: readonly DebtDue[], currency: string): string | null {
  if (!debtsDue.length) return null;
  const total = debtsDue.reduce((sum, debt) => sum + debt.amountMinor, 0);
  const amount = formatMoney(total, currency, { whole: true });
  return debtsDue.length === 1
    ? `${amount} to ${debtsDue[0]!.name}`
    : `${amount} to ${debtsDue.length} people`;
}

/** "RM443 left for 18 days · RM24 a day", or "RM20 over". `after` names what else came off it. Null without a budget. */
export function leftLine(
  summary: SpentSummary,
  currency: string,
  after?: string | null,
): string | null {
  const { leftMinor, daysLeft, perDayMinor } = summary;
  if (leftMinor === null) return null;
  const whole = (minor: number) => formatMoney(minor, currency, { whole: true });
  if (leftMinor < 0) return `${whole(-leftMinor)} over`;
  const days = `${daysLeft} ${daysLeft === 1 ? 'day' : 'days'}${after ? ` after ${after}` : ''}`;
  return perDayMinor === null
    ? `${whole(leftMinor)} left for ${days}`
    : `${whole(leftMinor)} left for ${days} · ${whole(perDayMinor)} a day`;
}

/** "today", "tomorrow", or "on Fri 16 Oct" for a local YYYY-MM-DD. */
export function dueWhen(dueDate: string, now: Date): string {
  const due = parseLocalDateInput(dueDate);
  if (!due) return `on ${dueDate}`;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const days = Math.round((due.getTime() - today.getTime()) / 86_400_000);
  return days <= 0 ? 'today' : days === 1 ? 'tomorrow' : `on ${formatDate(due, now)}`;
}
