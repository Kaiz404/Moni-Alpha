import { fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import type { ReactNode } from 'react';

import ReportsScreen from '@/app/reports';
import { financeProjection$ } from '@/lib/finance/projection';
import type { FinanceTransaction } from '@/lib/finance/types';

const mockNow = new Date(2026, 9, 14, 12, 0);

function mockTransaction(
  id: string,
  day: Date,
  amountMinor: number,
  over: Partial<FinanceTransaction> = {},
): FinanceTransaction {
  const iso = day.toISOString();
  return {
    id,
    userId: 'kai',
    walletId: 'maybank',
    amountMinor,
    currency: 'MYR',
    type: 'expense',
    analysisExcluded: false,
    debtActivityId: null,
    categoryId: null,
    transferToWalletId: null,
    linkedTransactionId: null,
    description: null,
    merchant: null,
    notes: null,
    transactionDate: iso,
    locationLatitude: null,
    locationLongitude: null,
    locationName: null,
    autoAdded: false,
    balanceCorrection: false,
    createdAt: iso,
    ...over,
  } as FinanceTransaction;
}

let mockWallets: { id: string }[] = [{ id: 'maybank' }];

jest.mock('expo-router', () => ({
  router: { dismissTo: jest.fn(), push: jest.fn(), back: jest.fn() },
  useLocalSearchParams: () => ({}),
}));
jest.mock('@/components/ui/page', () => ({
  Page: ({ title, trailing, children }: { title: string; trailing: ReactNode; children: ReactNode }) => {
    const { Text, View } = require('react-native');
    return (
      <View>
        <Text>{title}</Text>
        {trailing}
        {children}
      </View>
    );
  },
}));
jest.mock('@/lib/haptics', () => ({ scrubStep: jest.fn() }));
jest.mock('uniwind', () => ({
  useCSSVariable: (names: string[]) => names.map(() => undefined),
  useUniwind: () => ({ theme: 'light' }),
}));
jest.mock('@/components/budget/use-budget', () => ({
  useBudgetData: () => ({
    userId: 'kai',
    now: mockNow,
    currency: 'MYR',
    wallets: mockWallets,
    walletNames: { maybank: 'Maybank' },
    aliases: [{ rawKey: 'grab', displayName: 'Grab ride' }],
    transactions: [
      mockTransaction('a', new Date(2026, 9, 2), 15050, { categoryId: 'food', merchant: 'GRAB*12' }),
      mockTransaction('b', new Date(2026, 9, 3), 990, { description: 'Parking' }),
      mockTransaction('c', new Date(2026, 9, 4), 420000, { type: 'income' }),
      mockTransaction('d', new Date(2026, 8, 2), 4000, { categoryId: 'food', merchant: 'GRAB*12' }),
    ],
  }),
}));

beforeEach(() => {
  mockWallets = [{ id: 'maybank' }];
  (router.dismissTo as jest.Mock).mockClear();
  financeProjection$.categoriesById.set({
    food: {
      id: 'food',
      userId: null,
      name: 'Food & Dining',
      icon: 'silverware',
      type: 'expense',
      color: '#F1A399',
      isActive: true,
      displayOrder: 0,
    },
  });
});

describe('Reports', () => {
  it('shows income against spending and what changed from last month', () => {
    render(<ReportsScreen />);
    expect(screen.getByTestId('reports.spent')).toHaveTextContent('RM160.40');
    expect(screen.getByTestId('reports.in')).toHaveTextContent('+RM4,200.00');
    expect(screen.getByText('RM120.40 more than Sep by now')).toBeTruthy();
    expect(screen.getByText('RM110.50 more than Sep by now')).toBeTruthy();
    expect(screen.getByText('Nothing in Sep by now')).toBeTruthy();
  });

  it('opens a category row in Activity with its month', () => {
    render(<ReportsScreen />);
    fireEvent.press(screen.getByTestId('reports.category.food'));
    expect(router.dismissTo).toHaveBeenCalledWith({
      pathname: '/activity',
      params: { categoryId: 'food', month: '2026-10' },
    });
  });

  it('opens spending with no category in Activity', () => {
    render(<ReportsScreen />);
    fireEvent.press(screen.getByTestId('reports.category.none'));
    expect(router.dismissTo).toHaveBeenCalledWith({
      pathname: '/activity',
      params: { categoryId: 'none', month: '2026-10' },
    });
  });

  it('opens a merchant row by its merchant name', () => {
    render(<ReportsScreen />);
    fireEvent.press(screen.getByTestId('reports.merchant.grab-ride'));
    expect(router.dismissTo).toHaveBeenCalledWith({
      pathname: '/activity',
      params: { q: 'Grab ride' },
    });
  });

  it('opens a month from its bar', () => {
    render(<ReportsScreen />);
    fireEvent.press(screen.getByTestId('reports.trend.2026-09'));
    expect(screen.getByTestId('reports.spent')).toHaveTextContent('RM40.00');
  });

  it('offers a custom period with From and To', () => {
    render(<ReportsScreen />);
    expect(screen.queryByTestId('reports.from')).toBeNull();
    fireEvent.press(screen.getByTestId('reports.view.custom'));
    expect(screen.getByTestId('reports.from')).toBeTruthy();
    expect(screen.getByTestId('reports.to')).toBeTruthy();
    expect(screen.queryByTestId('reports.month')).toBeNull();
  });

  it('says so when a month has no spending', () => {
    render(<ReportsScreen />);
    fireEvent.press(screen.getByTestId('reports.trend.2026-07'));
    expect(screen.getByText('Nothing spent in this period')).toBeTruthy();
  });

  it('starts with a wallet when there is none', () => {
    mockWallets = [];
    render(<ReportsScreen />);
    expect(screen.getByTestId('reports.add-a-wallet')).toBeTruthy();
    expect(screen.queryByTestId('reports.spent')).toBeNull();
  });
});
