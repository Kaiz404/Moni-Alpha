import { render, screen } from '@testing-library/react-native';

import type { CaptureDraft } from '@/lib/capture/capture-stage';
import { financeProjection$ } from '@/lib/finance/projection';
import { EMPTY_FINANCE_PROJECTION } from '@/lib/finance/types';
import type { TransactionRowData } from '@/lib/transactions/row';

import { CaptureResult } from '../capture-result-card';
import { CaptureAdded } from '../scan-stages';

jest.mock('@/lib/auth/auth-context', () => ({
  useAuth: () => ({ user: { id: 'kai' } }),
}));
jest.mock('@/lib/supabase/profile', () => ({
  ensureFinanceTimezone: () => Promise.resolve('Asia/Kuala_Lumpur'),
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
    autoAddRules$: observable({}),
    merchantAliases$: observable({}),
    profilePreferences$: observable({ currency: 'MYR' }),
    recurringOverrides$: observable({}),
    assertMigrated: () => {},
    isMigrated: () => true,
  };
});
jest.mock('expo-router', () => ({ router: { dismissTo: jest.fn(), back: jest.fn() } }));
jest.mock('uniwind', () => ({
  useCSSVariable: (names: string[]) => names.map(() => undefined),
  useUniwind: () => ({ theme: 'light' }),
  withUniwind: <T,>(component: T) => component,
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const draft: CaptureDraft = {
  kind: 'expense',
  merchant: '99 Speedmart',
  amountMinor: 1860 as CaptureDraft['amountMinor'],
  categoryId: null,
  walletId: null,
  transactionDate: new Date(2026, 9, 14, 14, 4).toISOString(),
  evidence: 'Moni read 6 items and a total of RM18.60.',
  itemCount: 6,
  place: { kind: 'auto' },
};

const checkPage = (itemCount: number | null) =>
  render(
    <CaptureResult
      quote={{ source: 'camera', imageUri: 'file:///receipt.jpg' }}
      draft={{ ...draft, itemCount }}
      here={{ status: 'none' }}
      onEdit={jest.fn()}
      again={{ label: 'Retake', icon: 'camera-retake-outline', onPress: jest.fn() }}
      onApprove={jest.fn()}
      approving={false}
    />,
  );

const row: TransactionRowData = {
  kind: 'expense',
  title: '99 Speedmart',
  date: new Date(2026, 9, 14, 14, 4).toISOString(),
  amountMinor: 1860 as TransactionRowData['amountMinor'],
  currency: 'MYR' as TransactionRowData['currency'],
  icon: 'cart',
  color: null,
  category: 'Groceries',
  wallet: 'Cash',
  autoAdded: false,
};

const addedPage = (itemCount: number | null) =>
  render(
    <CaptureAdded
      row={row}
      categoryName="Groceries"
      itemCount={itemCount}
      another={{ label: 'Scan another', onPress: jest.fn() }}
    />,
  );

describe('the receipt item count', () => {
  beforeEach(() => financeProjection$.set(EMPTY_FINANCE_PROJECTION));

  it('leaves the check page without a Receipt meta line', async () => {
    checkPage(6);
    expect(await screen.findByLabelText('The scanned receipt')).toBeTruthy();
    expect(screen.queryByText(/^Receipt/)).toBeNull();
  });

  it('ends the Added row meta', () => {
    addedPage(6);
    expect(screen.getByText(/ · Cash · 6 items$/)).toBeTruthy();
  });

  it('leaves the Added row meta alone with no count', () => {
    addedPage(null);
    expect(screen.getByText(/ · Cash$/)).toBeTruthy();
  });
});
