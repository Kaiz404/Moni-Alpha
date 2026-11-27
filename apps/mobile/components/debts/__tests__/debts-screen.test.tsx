import { act, fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import DebtsScreen from '@/app/(tabs)/debts';
import { financeProjection$ } from '@/lib/finance/projection';
import { dismissSheet, getOpenSheet } from '@/lib/sheet/sheet-store';
import { EMPTY_FINANCE_PROJECTION, type FinanceDebt, type FinanceDebtActivity } from '@repo/core';

jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
  useScrollToTop: jest.fn(),
}));
jest.mock('@/components/ui/page', () => ({
  ...jest.requireActual('@/components/ui/page'),
  Page: ({ children }: { children: ReactNode }) => children,
}));
jest.mock('@/lib/auth/auth-context', () => ({ useAuth: () => ({ user: { id: 'kai' } }) }));
jest.mock('@/lib/finance/main-currency', () => ({ useMainCurrency: () => 'MYR' }));
jest.mock('@/components/nav/tab-bar', () => ({ useTabBarClearance: () => 100 }));
jest.mock('@/components/providers/sync-banner', () => ({ SyncBanner: () => null }));
jest.mock('@/lib/store', () => ({}));
jest.mock('uniwind', () => ({
  useCSSVariable: (names: string[]) => names.map(() => undefined),
  useUniwind: () => ({ theme: 'light' }),
  withUniwind: <T,>(component: T) => component,
}));

const debt = (id: string, direction: FinanceDebt['direction']): FinanceDebt => ({
  id,
  userId: 'kai',
  counterpartyName: id,
  direction,
  currency: 'MYR',
  dueDate: null,
  note: null,
  status: 'open',
});

const entry = (id: string, debtId: string, kind: FinanceDebtActivity['kind'], amountMinor: number) =>
  ({
    id,
    userId: 'kai',
    debtId,
    kind,
    amountMinor,
    activityDate: '2026-10-01T06:00:00.000Z',
    walletId: null,
    cashTransactionId: null,
    note: null,
  }) as FinanceDebtActivity;

const settleSheet = (result: unknown) =>
  act(() => {
    (getOpenSheet() as unknown as { settle: (value: unknown) => void }).settle(result);
    return Promise.resolve();
  });

const rows = () => screen.queryAllByTestId(/^debts\.(person|settled)\./).map((row) => row.props.testID as string);

beforeEach(() => {
  financeProjection$.set({
    ...EMPTY_FINANCE_PROJECTION,
    debtsById: { Aiman: debt('Aiman', 'owed_to_me'), Mei: debt('Mei', 'i_owe'), Hana: debt('Hana', 'owed_to_me') },
    debtActivitiesById: {
      a1: entry('a1', 'Aiman', 'principal', 10000),
      m1: entry('m1', 'Mei', 'principal', 4000),
      h1: entry('h1', 'Hana', 'principal', 2000),
      h2: entry('h2', 'Hana', 'repayment', 2000),
    },
  } as typeof EMPTY_FINANCE_PROJECTION);
});
afterEach(() => act(() => dismissSheet()));

describe('Debts filters', () => {
  it('start with every side and status ticked, settled debts after the open ones', () => {
    render(<DebtsScreen />);
    expect(screen.getByTestId('debts.filter.side')).toHaveTextContent('Everyone');
    expect(screen.getByTestId('debts.filter.status')).toHaveTextContent('All');
    expect(rows()).toEqual(['debts.person.aiman', 'debts.person.mei', 'debts.settled.hana']);

    fireEvent.press(screen.getByTestId('debts.filter.status'));
    const sheet = getOpenSheet();
    expect(sheet?.kind).toBe('choices');
    expect((sheet?.request as { selectedIds: string[] }).selectedIds).toEqual([]);
  });

  it('keep to what is ticked and name the one choice left', async () => {
    render(<DebtsScreen />);
    fireEvent.press(screen.getByTestId('debts.filter.side'));
    await settleSheet({ ids: ['owed_to_me'] });
    expect(screen.getByTestId('debts.filter.side')).toHaveTextContent('Owed to you');
    expect(rows()).toEqual(['debts.person.aiman', 'debts.settled.hana']);

    fireEvent.press(screen.getByTestId('debts.filter.status'));
    await settleSheet({ ids: ['closed'] });
    expect(screen.getByTestId('debts.filter.status')).toHaveTextContent('Settled');
    expect(rows()).toEqual(['debts.settled.hana']);

    fireEvent.press(screen.getByTestId('debts.filter.side'));
    expect((getOpenSheet()?.request as { selectedIds: string[] }).selectedIds).toEqual(['owed_to_me']);
    await settleSheet({ ids: [] });
    expect(screen.getByTestId('debts.filter.side')).toHaveTextContent('Everyone');
  });
});
