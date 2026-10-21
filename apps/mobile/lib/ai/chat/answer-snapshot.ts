import { selectUpcomingBills } from '@/lib/finance/bills';
import { selectMainCurrency } from '@/lib/finance/main-currency';
import { financeProjection$ } from '@/lib/finance/projection';
import { budgetProgress$, debtsWithBalance$, transactions$ } from '@/lib/finance/selectors';
import { selectSpentSummary } from '@/lib/finance/spent-summary';
import { profilePreferences$ } from '@/lib/store';
import { listRecurringOverrides } from '@/lib/supabase/recurring-overrides';

import type { AnswerSnapshot } from './answer-cards';
import { financeTimezone } from './sessions';

/** This month in the main currency, read from the ledger the moment a question is asked. */
export function buildAnswerSnapshot(userId: string, now: Date = new Date()): AnswerSnapshot {
  const currency = selectMainCurrency(profilePreferences$.peek());
  const transactions = transactions$({ userId }).peek();
  const summary = selectSpentSummary({
    now,
    currency,
    transactions,
    budgets: Object.values(financeProjection$.budgetsById.peek()).filter(
      (budget) => budget.userId === userId,
    ),
    bills: selectUpcomingBills(now, transactions, listRecurringOverrides(userId)),
    debts: debtsWithBalance$(userId)
      .peek()
      .map(({ debt, balanceMinor }) => ({ debt, balanceMinor: Number(balanceMinor) })),
  });
  return {
    currency,
    categories: budgetProgress$(userId, financeTimezone())
      .peek()
      .filter((row) => row.currency === currency && row.categoryIsActive)
      .map((row) => ({
        id: row.categoryId,
        name: row.categoryName,
        spent: Number(row.spentMinor),
        budget: row.budgetAmountMinor === null ? null : Number(row.budgetAmountMinor),
      })),
    month: {
      spent: summary.spentMinor,
      budget: summary.budgetMinor,
      left: summary.leftMinor,
      daysLeft: summary.daysLeft,
      perDay: summary.perDayMinor,
    },
    bills: summary.bills.map((bill) => ({
      seriesKey: bill.seriesKey,
      name: bill.name,
      amount: Number(bill.amountMinor),
      dueDate: bill.dueDate,
    })),
  };
}
