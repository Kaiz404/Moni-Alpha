import { useValue } from '@legendapp/state/react';
import { decimalToMinor, type MinorAmount } from '@repo/types';
import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';

import { useAuth } from '@/lib/auth/auth-context';
import { selectUpcomingBills } from '@/lib/finance/bills';
import { buildBudgetMonth, type BudgetMonth, type MonthKey } from '@/lib/finance/budget-month';
import { useMainCurrency } from '@/lib/finance/main-currency';
import { financeProjection$ } from '@/lib/finance/projection';
import { debtsWithBalance$, transactions$, walletsForUser$ } from '@/lib/finance/selectors';
import { profilePreferences$, recurringOverrides$ } from '@/lib/store';
import { getRecordValues } from '@/lib/store/helpers';
import { listMerchantAliases } from '@/lib/supabase/merchant-aliases';
import {
  selectRecurringOverrides,
  type RecurringOverrideRow,
} from '@/lib/supabase/recurring-overrides';

/** A clock that moves on when the screen comes back into focus, so "today" never goes stale. */
export function useNow(): Date {
  const [now, setNow] = useState(() => new Date());
  useFocusEffect(
    useCallback(() => {
      setNow(new Date());
    }, []),
  );
  return now;
}

/** Everything the Budget screens read, in the main currency's terms. */
export function useBudgetData() {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const now = useNow();
  const currency = useMainCurrency();
  const transactions = useValue(transactions$({ userId }));
  const wallets = useValue(walletsForUser$(userId));
  const debts = useValue(debtsWithBalance$(userId));
  const categories = useValue(() =>
    Object.values(financeProjection$.categoriesById.get()).filter(
      (category) =>
        (category.userId === null || category.userId === userId) &&
        category.isActive &&
        category.type !== 'income',
    ),
  );
  const budgets = useValue(() =>
    Object.values(financeProjection$.budgetsById.get()).filter(
      (budget) => budget.userId === userId,
    ),
  );
  const aliases = useValue(() => (userId ? listMerchantAliases(userId) : []));
  const monthlyTotal = useValue(() => profilePreferences$.get()?.monthly_budget ?? null);
  const overrides = useValue(() =>
    userId
      ? selectRecurringOverrides(getRecordValues<RecurringOverrideRow>(recurringOverrides$), userId)
      : [],
  );
  const bills = useMemo(
    () => selectUpcomingBills(now, transactions, overrides),
    [now, transactions, overrides],
  );
  const walletNames = useMemo(
    () => Object.fromEntries(wallets.map((wallet) => [wallet.id, wallet.name])),
    [wallets],
  );
  return {
    userId,
    now,
    currency,
    transactions,
    wallets,
    walletNames,
    aliases,
    categories,
    budgets,
    monthlyTotalMinor: monthlyTotal === null ? null : (decimalToMinor(monthlyTotal) as MinorAmount),
    overrides,
    bills,
    debts,
  };
}

export type BudgetData = ReturnType<typeof useBudgetData>;

export function useBudgetMonth(data: BudgetData, month: MonthKey): BudgetMonth {
  return useMemo(
    () =>
      buildBudgetMonth({
        month,
        now: data.now,
        currency: data.currency,
        transactions: data.transactions,
        categories: data.categories,
        budgets: data.budgets,
        monthlyTotalMinor: data.monthlyTotalMinor,
        bills: data.bills,
        debts: data.debts,
      }),
    [
      month,
      data.now,
      data.currency,
      data.transactions,
      data.categories,
      data.budgets,
      data.monthlyTotalMinor,
      data.bills,
      data.debts,
    ],
  );
}
