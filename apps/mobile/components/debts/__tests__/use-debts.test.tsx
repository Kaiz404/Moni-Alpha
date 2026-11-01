import { act, renderHook } from '@testing-library/react-native';

import { useDebtSummary } from '@/components/debts/use-debts';
import { financeProjection$ } from '@/lib/finance/projection';
import { EMPTY_FINANCE_PROJECTION, type FinanceDebt, type FinanceDebtActivity } from '@/lib/finance/types';

jest.mock('@/lib/auth/auth-context', () => ({
  useAuth: () => ({ user: { id: 'user_1' } }),
}));
jest.mock('@/lib/finance/main-currency', () => ({
  useMainCurrency: () => 'MYR',
}));
jest.mock('@/lib/store', () => {
  const { observable } = jest.requireActual('@legendapp/state');
  return {
    wallets$: observable({}),
    transactions$: observable({}),
    categories$: observable({}),
    categoryBudgets$: observable({}),
    debts$: observable({}),
    debtActivities$: observable({}),
    proposedTransactions$: observable({}),
  };
});

const debt = (id: string, counterpartyName: string): FinanceDebt => ({
  id,
  userId: 'user_1',
  counterpartyName,
  direction: 'owed_to_me',
  currency: 'MYR',
  dueDate: null,
  note: null,
  status: 'open',
});

const principal = (id: string, debtId: string, amountMinor: number): FinanceDebtActivity =>
  ({
    id,
    userId: 'user_1',
    debtId,
    kind: 'principal',
    amountMinor,
    activityDate: '2026-10-14T06:06:00.000Z',
    walletId: 'wallet_1',
    cashTransactionId: 'cash_1',
    note: null,
  }) as FinanceDebtActivity;

describe('useDebtSummary', () => {
  beforeEach(() => {
    financeProjection$.set({
      ...EMPTY_FINANCE_PROJECTION,
      debtsById: { aiman: debt('aiman', 'Aiman') },
      debtActivitiesById: { a1: principal('a1', 'aiman', 15000) },
    });
  });

  it('adds a debt recorded while the Debts tab stays mounted to People and the totals', () => {
    const { result } = renderHook(() => useDebtSummary());
    expect(result.current.owedToMeMinor).toBe(15000);

    act(() => {
      financeProjection$.debtsById.hana.set(debt('hana', 'Hana'));
      financeProjection$.debtActivitiesById.a2.set(principal('a2', 'hana', 5000));
    });

    expect(result.current.owedToMeMinor).toBe(20000);
    expect(result.current.open.map((line) => line.debt.counterpartyName)).toEqual([
      'Aiman',
      'Hana',
    ]);
  });
});
