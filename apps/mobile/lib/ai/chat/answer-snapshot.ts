import { decimalToMinor, type MinorAmount } from '@repo/types';

import { selectUpcomingBills } from '@/lib/finance/bills';
import { buildBudgetMonth, monthKey } from '@/lib/finance/budget-month';
import { selectMainCurrency } from '@/lib/finance/main-currency';
import { financeProjection$ } from '@/lib/finance/projection';
import { debtsWithBalance$, transactions$ } from '@/lib/finance/selectors';
import { profilePreferences$ } from '@/lib/store';
import { listAwaitingReview } from '@/lib/supabase/proposed-transactions';
import { listRecurringOverrides } from '@/lib/supabase/recurring-overrides';

import type { AnswerSnapshot } from './answer-cards';

/** This month in the main currency, read from the ledger the moment a question is asked. */
export function buildAnswerSnapshot(userId: string, now: Date = new Date()): AnswerSnapshot {
  const preferences = profilePreferences$.peek();
  const currency = selectMainCurrency(preferences);
  const transactions = transactions$({ userId }).peek();
  const projection = financeProjection$.peek();
  const month = buildBudgetMonth({
    month: monthKey(now),
    now,
    currency,
    transactions,
    categories: Object.values(projection.categoriesById).filter(
      (category) =>
        (category.userId === null || category.userId === userId) &&
        category.isActive &&
        category.type !== 'income',
    ),
    budgets: Object.values(projection.budgetsById).filter((budget) => budget.userId === userId),
    monthlyTotalMinor:
      preferences?.monthly_budget == null
        ? null
        : (decimalToMinor(preferences.monthly_budget) as MinorAmount),
    bills: selectUpcomingBills(now, transactions, listRecurringOverrides(userId)),
    debts: debtsWithBalance$(userId).peek(),
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
      daysLeft: month.left?.daysLeft ?? month.daysInMonth - now.getDate() + 1,
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
