import { selectMainCurrency } from '@/lib/finance/main-currency';
import { financeProjection$ } from '@/lib/finance/projection';
import { debtsWithBalance$, transactions$ } from '@/lib/finance/selectors';
import { profilePreferences$ } from '@/lib/store';
import { listAwaitingReview } from '@/lib/supabase/proposed-transactions';
import { listRecurringOverrides } from '@/lib/supabase/recurring-overrides';
import { buildMoneyMonth, moneyLedger } from '@repo/core';

import type { AnswerSnapshot } from './answer-cards';
import { deviceCalendar } from '@/lib/dates/device-calendar';

/** This month in the main currency, read from the ledger the moment a question is asked. */
export function buildAnswerSnapshot(userId: string, now: Date = new Date()): AnswerSnapshot {
  const preferences = profilePreferences$.peek();
  const currency = selectMainCurrency(preferences);
  const projection = financeProjection$.peek();
  const ledger = moneyLedger(
    {
      userId,
      transactions: transactions$({ userId }).peek(),
      categoriesById: projection.categoriesById,
      budgetsById: projection.budgetsById,
      monthlyBudget: preferences?.monthly_budget,
      overrides: listRecurringOverrides(userId),
      debts: debtsWithBalance$(userId).peek(),
    },
    now,
    deviceCalendar,
  );
  const month = buildMoneyMonth(ledger, {
    month: deviceCalendar.monthKey(now),
    currency,
    now,
    calendar: deviceCalendar,
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
    waiting: listAwaitingReview(now)
      .filter((proposal) => proposal.userId === userId)
      .map((proposal) => proposal.id),
    bills: month.billsDue.map((bill) => ({
      seriesKey: bill.seriesKey,
      name: bill.name,
      amount: Number(bill.amountMinor),
      dueDate: bill.dueDate,
      walletName: bill.walletId ? (projection.walletsById[bill.walletId]?.name ?? null) : null,
    })),
  };
}
