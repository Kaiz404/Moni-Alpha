import { act, fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { Keyboard } from 'react-native';

import TransactionDetailScreen from '@/app/transaction/[id]';
import { formatDate } from '@/lib/dates/day-label';
import type { FinanceTransaction } from '@/lib/finance/types';
import { dismissSheet, getOpenSheet } from '@/lib/sheet/sheet-store';
import { updateTransaction } from '@/lib/supabase/transactions';
import { dismissToast } from '@/lib/toast/toast-store';

const mockRow: FinanceTransaction = {
  id: 't1',
  userId: 'kai',
  walletId: 'maybank',
  amountMinor: 1500,
  currency: 'MYR',
  type: 'expense',
  analysisExcluded: false,
  debtActivityId: null,
  categoryId: null,
  transferToWalletId: null,
  linkedTransactionId: null,
  description: null,
  merchant: 'SHELL',
  notes: null,
  transactionDate: new Date(2026, 10, 16, 20, 48).toISOString(),
  locationLatitude: null,
  locationLongitude: null,
  locationName: null,
  placeId: null,
  placeCoordsAt: null,
  autoAdded: false,
  balanceCorrection: false,
  createdAt: new Date(2026, 10, 16, 20, 48).toISOString(),
} as unknown as FinanceTransaction;

let mockHidden: (() => void) | null = null;

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), dismissTo: jest.fn() },
  useLocalSearchParams: () => ({ id: 't1' }),
}));
jest.mock('@/components/ui/page', () => ({
  ...jest.requireActual('@/components/ui/page'),
  Page: ({ children }: { children: ReactNode }) => children,
  PageScroll: ({ children }: { children: ReactNode }) => children,
}));
jest.mock('@legendapp/state/react', () => ({
  useValue: (read: () => unknown) => read(),
}));
jest.mock('@/lib/store', () => ({
  transactions$: { t1: { get: () => ({ metadata: { source: 'notification' } }) } },
}));
jest.mock('@/lib/finance/selectors', () => ({
  transactionById$: () => () => mockRow,
  transactions$: () => () => [mockRow],
  walletsForUser$: () => () => [
    { id: 'maybank', name: 'Maybank', currency: 'MYR', type: 'bank', icon: null, color: '#7B61FF', cardStyleId: null },
  ],
  categoriesForUser$: () => () => [],
  budgetProgress$: () => () => [],
}));
jest.mock('@/lib/auth/auth-context', () => ({ useAuth: () => ({ user: { id: 'kai' } }) }));
jest.mock('@/lib/supabase/merchant-aliases', () => ({
  listMerchantAliases: () => [],
  nameMerchant: jest.fn(),
}));
jest.mock('@/lib/supabase/profile', () => ({ ensureFinanceTimezone: () => new Promise(() => {}) }));
jest.mock('@/lib/supabase/transactions', () => ({
  updateTransaction: jest.fn(async () => {}),
  deleteTransaction: jest.fn(),
  setTransactionReceipt: jest.fn(),
}));
jest.mock('@/lib/receipts/images', () => ({}));
jest.mock('uniwind', () => ({
  useCSSVariable: (names: string[]) => names.map(() => undefined),
  useUniwind: () => ({ theme: 'light' }),
  withUniwind: <T,>(component: T) => component,
}));

beforeEach(() => {
  jest
    .spyOn(Keyboard, 'addListener')
    .mockImplementation((event, listener) => {
      if (event === 'keyboardDidHide') mockHidden = listener as () => void;
      return { remove: () => {} } as ReturnType<typeof Keyboard.addListener>;
    });
});
afterEach(() => {
  act(() => dismissToast());
  jest.clearAllMocks();
});

describe('Transaction detail', () => {
  it('shows only the date and time under a notification row\'s name', () => {
    render(<TransactionDetailScreen />);
    expect(screen.getByText(`${formatDate(mockRow.transactionDate)} · 8:48 pm`)).toBeTruthy();
    expect(screen.queryByText(/Alert says/)).toBeNull();
    expect(screen.queryByText('Keeps the slip with this transaction')).toBeNull();
  });

  it('saves the typed note when the keyboard closes, with no tick to press', async () => {
    render(<TransactionDetailScreen />);
    fireEvent.changeText(screen.getByTestId('txn.note'), '  With Mei ');
    await act(async () => mockHidden?.());
    expect(updateTransaction).toHaveBeenCalledWith('t1', { notes: 'With Mei' });
    expect(screen.queryByTestId('txn.note.save')).toBeNull();
  });

  it('saves the typed note when the page closes with the keyboard up', async () => {
    const page = render(<TransactionDetailScreen />);
    fireEvent.changeText(screen.getByTestId('txn.note'), 'Lunch');
    await act(async () => page.unmount());
    expect(updateTransaction).toHaveBeenCalledTimes(1);
    expect(updateTransaction).toHaveBeenCalledWith('t1', { notes: 'Lunch' });
  });

  it('asks before a change of type with a button that reads Confirm', () => {
    render(<TransactionDetailScreen />);
    fireEvent.press(screen.getByTestId('txn.tile.type'));
    const sheet = getOpenSheet();
    expect(sheet?.kind === 'confirm' && sheet.request).toMatchObject({
      title: 'Make this income?',
      confirmLabel: 'Confirm',
      cancelLabel: 'Keep it',
    });
    act(() => dismissSheet());
  });

  it('does not save a note that did not change', async () => {
    const page = render(<TransactionDetailScreen />);
    fireEvent(screen.getByTestId('txn.note'), 'blur');
    await act(async () => page.unmount());
    expect(updateTransaction).not.toHaveBeenCalled();
  });
});
