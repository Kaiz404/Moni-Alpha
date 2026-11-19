import { act, fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { Image } from 'expo-image';
import { Keyboard, Linking } from 'react-native';

import TransactionDetailScreen from '@/app/transaction/[id]';
import { dismissSheet, getOpenSheet } from '@/lib/sheet/sheet-store';
import { updateTransaction } from '@/lib/supabase/transactions';
import { dismissToast } from '@/lib/toast/toast-store';
import { type FinanceTransaction, dateLabel } from '@repo/core';
import { deviceCalendar } from '@/lib/dates/device-calendar';

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
  locationName: 'Shell Bangsar, Jalan Maarof, Bangsar, Kuala Lumpur',
  placeId: null,
  placeCoordsAt: null,
  autoAdded: false,
  balanceCorrection: false,
  createdAt: new Date(2026, 10, 16, 20, 48).toISOString(),
} as unknown as FinanceTransaction;

let mockHidden: (() => void) | null = null;
let mockRaw: Record<string, unknown> = { metadata: { source: 'notification' } };
const mockSigns: string[] = [];

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
  transactions$: { t1: { get: () => mockRaw } },
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
jest.mock('@/lib/supabase/client', () => ({
  supabase: {
    storage: {
      from: (bucket: string) => ({
        createSignedUrl: async (path: string, seconds: number) => {
          mockSigns.push(`${bucket} ${path} ${seconds}`);
          return { data: { signedUrl: `https://dev.supabase.co/storage/v1/object/sign/${bucket}/${path}?token=t1` }, error: null };
        },
      }),
    },
  },
}));
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
  mockRaw = { metadata: { source: 'notification' } };
  mockSigns.length = 0;
});

describe('Transaction detail', () => {
  it('shows only the date and time under a notification row\'s name', () => {
    render(<TransactionDetailScreen />);
    expect(screen.getByText(`${dateLabel(deviceCalendar.dayKey(mockRow.transactionDate), deviceCalendar.dayKey(new Date()))} at 8:48 pm`)).toBeTruthy();
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

  it('shows a stored receipt photo through a signed link and opens the same link', async () => {
    mockRaw = { metadata: { source: 'camera' }, receipt_image_url: 'kai/t1.jpg' };
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    render(<TransactionDetailScreen />);
    await act(async () => {});
    const signed = 'https://dev.supabase.co/storage/v1/object/sign/receipts/kai/t1.jpg?token=t1';
    expect(screen.UNSAFE_queryAllByType(Image).map((image) => (image.props.source as { uri: string }).uri)).toEqual([signed]);
    await act(async () => fireEvent.press(screen.getByTestId('txn.link.receipt')));
    expect(openURL).toHaveBeenCalledWith(signed);
    expect(mockSigns).toEqual(['receipts kai/t1.jpg 3600']);
  });

  it('names the place with no area or open map line under it', () => {
    render(<TransactionDetailScreen />);
    expect(screen.getByTestId('txn.link.place')).toHaveProp('accessibilityLabel', 'Shell Bangsar');
    expect(screen.queryByText(/open map/)).toBeNull();
  });

  it('does not save a note that did not change', async () => {
    const page = render(<TransactionDetailScreen />);
    fireEvent(screen.getByTestId('txn.note'), 'blur');
    await act(async () => page.unmount());
    expect(updateTransaction).not.toHaveBeenCalled();
  });
});
