import { useValue } from '@legendapp/state/react';

import { useAuth } from '@/lib/auth/auth-context';
import {
  describeDebt,
  summarizeDebts,
  type DebtLine,
  type DebtSummary,
} from '@/lib/finance/debt-summary';
import { useMainCurrency } from '@/lib/finance/main-currency';
import { financeProjection$ } from '@/lib/finance/projection';
import type { FinanceDebt, FinanceDebtActivity } from '@/lib/finance/types';

function useOwnDebts(): {
  debts: FinanceDebt[];
  activities: FinanceDebtActivity[];
} {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  // Read inside the selector and never memoize on the maps: a row's set() changes its map in place,
  // so the map's reference stays the same and a memo keyed on it would never see a new debt.
  return useValue(() => ({
    debts: Object.values(financeProjection$.debtsById.get() ?? {}).filter(
      (debt) => debt.userId === userId,
    ),
    activities: Object.values(financeProjection$.debtActivitiesById.get() ?? {}),
  }));
}

export function useDebtSummary(): DebtSummary {
  const { debts, activities } = useOwnDebts();
  const currency = useMainCurrency();
  return summarizeDebts(debts, activities, new Date(), currency);
}

/** One debt and its activities, newest first, in whatever currency it is in. */
export function useDebt(id: string | undefined): {
  line: DebtLine | null;
  activities: FinanceDebtActivity[];
} {
  const { debts, activities } = useOwnDebts();
  const debt = debts.find((item) => item.id === id);
  const own = activities
    .filter((activity) => activity.debtId === id)
    .sort((a, b) => b.activityDate.localeCompare(a.activityDate));
  return { line: debt ? describeDebt(debt, own) : null, activities: own };
}

/** Every debt with its money, for Record a debt's people chips and its existing-debt check. */
export function useDebtLines(): DebtLine[] {
  const { debts, activities } = useOwnDebts();
  return debts
    .map((debt) => describeDebt(debt, activities))
    .filter((line): line is DebtLine => line !== null);
}
