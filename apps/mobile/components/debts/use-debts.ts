import { useValue } from '@legendapp/state/react';
import { useMemo } from 'react';

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
  const debtsById = useValue(financeProjection$.debtsById);
  const activitiesById = useValue(financeProjection$.debtActivitiesById);
  return useMemo(
    () => ({
      debts: Object.values(debtsById ?? {}).filter((debt) => debt.userId === userId),
      activities: Object.values(activitiesById ?? {}),
    }),
    [debtsById, activitiesById, userId],
  );
}

export function useDebtSummary(): DebtSummary {
  const { debts, activities } = useOwnDebts();
  const currency = useMainCurrency();
  return useMemo(
    () => summarizeDebts(debts, activities, new Date(), currency),
    [debts, activities, currency],
  );
}

/** One debt and its activities, newest first, in whatever currency it is in. */
export function useDebt(id: string | undefined): {
  line: DebtLine | null;
  activities: FinanceDebtActivity[];
} {
  const { debts, activities } = useOwnDebts();
  return useMemo(() => {
    const debt = debts.find((item) => item.id === id);
    const own = activities
      .filter((activity) => activity.debtId === id)
      .sort((a, b) => b.activityDate.localeCompare(a.activityDate));
    return { line: debt ? describeDebt(debt, own) : null, activities: own };
  }, [debts, activities, id]);
}

/** Every debt with its money, for Record a debt's people chips and its existing-debt check. */
export function useDebtLines(): DebtLine[] {
  const { debts, activities } = useOwnDebts();
  return useMemo(
    () =>
      debts
        .map((debt) => describeDebt(debt, activities))
        .filter((line): line is DebtLine => line !== null),
    [debts, activities],
  );
}
