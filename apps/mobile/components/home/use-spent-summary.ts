import { useValue } from '@legendapp/state/react';
import { useMemo } from 'react';

import { selectUpcomingBills } from '@/lib/finance/bills';
import { financeProjection$ } from '@/lib/finance/projection';
import { debtsWithBalance$, transactions$ } from '@/lib/finance/selectors';
import { listRecurringOverrides } from '@/lib/supabase/recurring-overrides';

import { selectSpentSummary, type SpentSummary } from './spent-summary';

export function useSpentSummary(userId: string | null, currency: string): SpentSummary {
  const transactions = useValue(transactions$({ userId }));
  const debts = useValue(debtsWithBalance$(userId));
  const budgets = useValue(() =>
    Object.values(financeProjection$.budgetsById.get()).filter(
      (budget) => budget.userId === userId,
    ),
  );
  const overrides = useValue(() => (userId ? listRecurringOverrides(userId) : []));
  return useMemo(() => {
    const now = new Date();
    return selectSpentSummary({
      now,
      currency,
      transactions,
      budgets,
      bills: selectUpcomingBills(now, transactions, overrides),
      debts: debts.map(({ debt, balanceMinor }) => ({
        debt,
        balanceMinor: Number(balanceMinor),
      })),
    });
  }, [currency, transactions, budgets, overrides, debts]);
}
