import 'react-native-gesture-handler/jestSetup';
import type { Observable } from '@legendapp/state';
import { decimalToMinor } from '@repo/types';
import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
} from '@testing-library/react-native';

import {
  dismissToast,
  undoToast,
  useToast,
} from '@/lib/toast/toast-store';
import { SheetHost } from '@/components/ui/sheet/sheet-host';
import { dismissSheet } from '@/lib/sheet/sheet-store';
import { financeWallet } from '@/lib/wallets/__tests__/balance-fixture';
import { WalletHero } from '../wallet-hero';

jest.mock('expo-crypto', () => ({
  randomUUID: () => 'correction-1',
}));
jest.mock('@/lib/supabase/client', () => ({
  getUserId: async () => 'user_1',
}));
jest.mock('@/lib/notifications/linked-packages-cache', () => ({
  refreshLinkedPackagesFromStore: jest.fn(),
}));
jest.mock('uniwind', () => ({
  useCSSVariable: (names: string[]) => names.map(() => undefined),
  useUniwind: () => ({ theme: 'light' }),
  withUniwind: <T,>(component: T) => component,
}));
jest.mock('react-native-reanimated', () => ({
  ...jest.requireActual<object>('react-native-reanimated/mock'),
  useReducedMotion: () => false,
  useAnimatedKeyboard: () => ({
    height: { get: () => 0 },
    state: { get: () => 0 },
  }),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@/lib/store', () => {
  const { observable } = jest.requireActual('@legendapp/state');
  return {
    assertMigrated: jest.fn(),
    isMigrated: () => false,
    wallets$: observable({
      cash: {
        id: 'cash',
        user_id: 'user_1',
        name: 'Cash',
        currency: 'MYR',
        balance_confirmed_at: '2026-09-04T02:00:00.000Z',
        deleted: false,
      },
    }),
    transactions$: observable({}),
  };
});

type Rows = Observable<Record<string, Record<string, unknown>>>;
const { wallets$, transactions$ } = jest.requireMock(
  '@/lib/store',
) as {
  wallets$: Rows;
  transactions$: Rows;
};

const cash = financeWallet({
  id: 'cash',
  name: 'Cash',
  type: 'cash',
  balanceConfirmedAt: '2026-09-04T02:00:00.000Z',
});
const noLink = {
  notificationPackage: null,
  notificationAppLabel: null,
  notificationAccountHint: null,
};

function renderFixIt() {
  render(
    <>
      <WalletHero
        wallet={cash}
        balanceMinor={decimalToMinor('63.60')}
        link={noLink}
        openBalance
      />
      <SheetHost />
    </>,
  );
}

describe('WalletHero balance correction', () => {
  afterEach(() =>
    act(() => {
      dismissSheet();
      dismissToast();
    }),
  );

  it('opens the balance sheet for Fix it, says saving adds a correction, and previews it', () => {
    renderFixIt();
    expect(screen.getByText('Edit Amount')).toBeTruthy();
    expect(
      screen.getByText('Adds a balance correction transaction for the difference.'),
    ).toBeTruthy();
    expect(screen.queryByText('Balance not right?')).toBeNull();
    fireEvent.changeText(
      screen.getByTestId('wallet.balance-sheet.input'),
      '60',
    );
  });

  it('writes one correction with Undo, and Undo removes it', async () => {
    const toast = renderHook(() => useToast()).result;
    renderFixIt();
    fireEvent.changeText(
      screen.getByTestId('wallet.balance-sheet.input'),
      '60',
    );
    await act(async () => {
      fireEvent.press(screen.getByTestId('wallet.balance-sheet.save'));
    });

    expect(transactions$['correction-1'].peek()).toMatchObject({
      wallet_id: 'cash',
      type: 'expense',
      amount: '3.60',
      description: 'Balance correction',
      analysis_excluded: true,
      metadata: { kind: 'balance_correction', source: 'manual' },
      deleted: false,
    });
    expect(toast.current?.text).toBe('Correction −RM3.60 added');
    expect(wallets$.cash.balance_confirmed_at.peek()).not.toBe(
      '2026-09-04T02:00:00.000Z',
    );

    act(() => undoToast());

    expect(transactions$['correction-1'].deleted.peek()).toBe(true);
    expect(wallets$.cash.balance_confirmed_at.peek()).toBe(
      '2026-09-04T02:00:00.000Z',
    );
  });
});
