import type { CurrencyCode } from '@repo/types';

import type { Calendar } from '../calendar';
import { buildMoneyMonth, moneyLedger, type MoneyLedgerRows } from '../money-month/month';
import type { FinanceWallet } from '../read-model/types';
import type { AnswerSnapshot } from './answer-cards';

/** The ledger an answer card reads, as the app holds it when a question is asked. */
export type AnswerSnapshotInput = MoneyLedgerRows & {
  /** The main currency: the snapshot is this month in it. */
  currency: CurrencyCode;
  /** The user's captures waiting for review, newest first. */
  waiting: readonly string[];
  walletsById: Record<string, Pick<FinanceWallet, 'name'>>;
  now: Date;
  calendar: Calendar;
};

/** This month in the main currency, which `pickAnswerCard` fills a card from. */
export function buildAnswerSnapshot({
  currency,
  waiting,
  walletsById,
  now,
  calendar,
  ...rows
}: AnswerSnapshotInput): AnswerSnapshot {
  const month = buildMoneyMonth(moneyLedger(rows, now, calendar), {
    month: calendar.monthKey(now),
    currency,
    now,
    calendar,
  });
  return {
    currency,
    categories: [...month.budgeted, ...month.unbudgeted].map((category) => ({
      id: category.categoryId,
      name: category.name,
      icon: category.icon,
      color: category.color,
      spent: Number(category.spentMinor),
      budget: category.budgetMinor === null ? null : Number(category.budgetMinor),
    })),
    month: {
      spent: Number(month.spentMinor),
      budget: month.budgetMinor === null ? null : Number(month.budgetMinor),
      left: month.left ? Number(month.left.leftMinor) : null,
      daysLeft: month.daysLeft,
      perDay: month.left && month.left.perDayMinor > 0 ? Number(month.left.perDayMinor) : null,
      owed: month.left?.debtsDue ?? [],
    },
    waiting: [...waiting],
    bills: month.billsDue.map((bill) => ({
      seriesKey: bill.seriesKey,
      name: bill.name,
      amount: Number(bill.amountMinor),
      dueDate: bill.dueDate,
      walletName: bill.walletId ? (walletsById[bill.walletId]?.name ?? null) : null,
    })),
  };
}
