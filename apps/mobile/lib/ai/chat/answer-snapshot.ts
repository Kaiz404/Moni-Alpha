import { buildAnswerSnapshot, type AnswerSnapshot } from '@repo/core';
import { deviceCalendar } from '@/lib/dates/device-calendar';
import { selectMainCurrency } from '@/lib/finance/main-currency';
import { financeProjection$ } from '@/lib/finance/projection';
import { debtsWithBalance$, transactions$ } from '@/lib/finance/selectors';
import { profilePreferences$ } from '@/lib/store';
import { listAwaitingReview } from '@/lib/supabase/proposed-transactions';
import { listRecurringOverrides } from '@/lib/supabase/recurring-overrides';

/** This month in the main currency, read from the ledger the moment a question is asked. */
export function peekAnswerSnapshot(userId: string, now: Date = new Date()): AnswerSnapshot {
  const preferences = profilePreferences$.peek();
  const projection = financeProjection$.peek();
  return buildAnswerSnapshot({
    userId,
    transactions: transactions$({ userId }).peek(),
    categoriesById: projection.categoriesById,
    budgetsById: projection.budgetsById,
    monthlyBudget: preferences?.monthly_budget,
    overrides: listRecurringOverrides(userId),
    debts: debtsWithBalance$(userId).peek(),
    currency: selectMainCurrency(preferences),
    waiting: listAwaitingReview()
      .filter((proposal) => proposal.userId === userId)
      .map((proposal) => proposal.id),
    walletsById: projection.walletsById,
    now,
    calendar: deviceCalendar,
  });
}
