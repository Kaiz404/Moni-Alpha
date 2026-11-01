import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import * as Location from 'expo-location';

import TypeItScreen from '@/app/transaction/new';
import { financeProjection$ } from '@/lib/finance/projection';
import { EMPTY_FINANCE_PROJECTION } from '@/lib/finance/types';
import { createTransaction } from '@/lib/supabase/transactions';
import { expense, financeWallet } from '@/lib/wallets/__tests__/balance-fixture';

jest.mock('expo-location', () => ({
  Accuracy: { Balanced: 3 },
  getForegroundPermissionsAsync: jest.fn(),
  requestForegroundPermissionsAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
  reverseGeocodeAsync: jest.fn(),
}));
jest.mock('@/lib/auth/auth-context', () => ({
  useAuth: () => ({ user: { id: 'user_1' } }),
}));
jest.mock('@/lib/supabase/profile', () => ({
  ensureFinanceTimezone: async () => 'Asia/Kuala_Lumpur',
}));
jest.mock('@/lib/supabase/client', () => ({ getUserId: async () => 'user_1' }));
jest.mock('@/lib/supabase/transactions', () => ({
  createTransaction: jest.fn(async () => ({ id: 'saved' })),
  createTransfer: jest.fn(),
}));
jest.mock('@/lib/supabase/proposed-transactions', () => ({
  getLedgerEntries: async () => [],
}));
jest.mock('@/lib/haptics', () => ({
  approve: jest.fn(),
  keypadTap: jest.fn(),
  scrubStep: jest.fn(),
}));
jest.mock('expo-router', () => ({
  router: { back: jest.fn(), dismissTo: jest.fn(), push: jest.fn(), replace: jest.fn() },
  useLocalSearchParams: () => ({}),
  useFocusEffect: () => {},
}));
jest.mock('uniwind', () => ({
  useCSSVariable: (names: string[]) => names.map(() => undefined),
  useUniwind: () => ({ theme: 'light' }),
  withUniwind: <T,>(component: T) => component,
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
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

const location = jest.mocked(Location);
const POSITION = { latitude: 3.13, longitude: 101.671 };
const MAYBANK = '00000000-0000-4000-8000-00000000000a';
const FOOD = '00000000-0000-4000-8000-0000000000f0';
const GROCERIES = '00000000-0000-4000-8000-0000000000f1';

function seedWallet(recordLocation: boolean) {
  financeProjection$.set({
    ...EMPTY_FINANCE_PROJECTION,
    walletsById: { [MAYBANK]: financeWallet({ id: MAYBANK, recordLocation }) },
  });
}

function permission(status: 'granted' | 'denied') {
  location.getForegroundPermissionsAsync.mockResolvedValue({
    status,
  } as Location.LocationPermissionResponse);
}

function positionAnswersLater() {
  let answer!: () => void;
  location.getCurrentPositionAsync.mockReturnValue(
    new Promise((resolve) => {
      answer = () => resolve({ coords: POSITION } as Location.LocationObject);
    }),
  );
  return answer;
}

async function openPage() {
  render(<TypeItScreen />);
  await act(async () => {});
}

async function addExpense() {
  fireEvent.press(screen.getByTestId('capture.key.5'));
  await act(async () => {
    fireEvent.press(screen.getByTestId('capture.submit'));
  });
  await waitFor(() => expect(createTransaction).toHaveBeenCalledTimes(1));
  return jest.mocked(createTransaction).mock.calls[0][0];
}

beforeEach(() => {
  jest.clearAllMocks();
  seedWallet(true);
  permission('granted');
  location.getCurrentPositionAsync.mockResolvedValue({
    coords: POSITION,
  } as Location.LocationObject);
  location.reverseGeocodeAsync.mockResolvedValue([
    { name: 'Jalan Telawi 3', city: 'Kuala Lumpur', region: 'Wilayah Persekutuan' },
  ] as Location.LocationGeocodedAddress[]);
});

describe('Type it location', () => {
  it('lets the user add an expense before the location answers', async () => {
    positionAnswersLater();
    await openPage();
    expect(screen.getByLabelText('Location, Finding. Remove it from this entry.')).toBeTruthy();
    expect(await addExpense()).toEqual(
      expect.not.objectContaining({ locationLatitude: expect.anything() }),
    );
  });

  it('shows the place and saves it with the entry', async () => {
    await openPage();
    expect(screen.getByText('Jalan Telawi 3')).toBeTruthy();
    expect(await addExpense()).toMatchObject({
      locationLatitude: 3.13,
      locationLongitude: 101.671,
      locationName: 'Jalan Telawi 3, Kuala Lumpur, Wilayah Persekutuan',
    });
  });

  it('takes the location off this entry when tapped', async () => {
    await openPage();
    fireEvent.press(screen.getByTestId('capture.location'));
    expect(screen.getByText('Not saved')).toBeTruthy();
    const saved = await addExpense();
    expect(saved.locationLatitude ?? null).toBeNull();
    expect(saved.locationName ?? null).toBeNull();
  });

  it('puts it back on a second tap', async () => {
    await openPage();
    fireEvent.press(screen.getByTestId('capture.location'));
    fireEvent.press(screen.getByTestId('capture.location'));
    expect(screen.getByText('Jalan Telawi 3')).toBeTruthy();
    expect(await addExpense()).toMatchObject({ locationLatitude: 3.13 });
  });

  it('stays off when it is removed before the position arrives', async () => {
    const answer = positionAnswersLater();
    await openPage();
    fireEvent.press(screen.getByTestId('capture.location'));
    await act(async () => answer());
    expect(screen.getByText('Not saved')).toBeTruthy();
    expect((await addExpense()).locationLatitude ?? null).toBeNull();
  });

  it('never asks, and saves nothing, when permission is denied', async () => {
    permission('denied');
    await openPage();
    expect(screen.queryByTestId('capture.location')).toBeNull();
    expect(location.requestForegroundPermissionsAsync).not.toHaveBeenCalled();
    expect(location.getCurrentPositionAsync).not.toHaveBeenCalled();
    expect((await addExpense()).locationLatitude ?? null).toBeNull();
  });

  it('saves nothing for a wallet whose app has location off', async () => {
    seedWallet(false);
    await openPage();
    expect(screen.queryByTestId('capture.location')).toBeNull();
    expect((await addExpense()).locationLatitude ?? null).toBeNull();
  });

  it('has no location on a transfer', async () => {
    await openPage();
    fireEvent.press(screen.getByText('Transfer'));
    expect(screen.queryByTestId('capture.location')).toBeNull();
  });
});

describe('Type it place chip', () => {
  const store = jest.requireMock('@/lib/store') as {
    categories$: { set: (rows: Record<string, unknown>) => void };
  };
  const category = (id: string, name: string, order: number) => ({
    id,
    user_id: 'user_1',
    name,
    type: 'expense',
    icon: 'shape-outline',
    color: null,
    is_active: true,
    display_order: order,
    deleted: false,
  });
  const rows = [
    expense('t1', '2026-10-01T04:00:00.000Z', {
      walletId: MAYBANK,
      merchant: 'Mamak Ali',
      categoryId: FOOD,
      locationLatitude: 3.13,
      locationLongitude: 101.671,
    }),
    expense('t2', '2026-10-20T04:00:00.000Z', {
      walletId: MAYBANK,
      merchant: 'Jaya Grocer',
      categoryId: GROCERIES,
    }),
  ];

  function seed(recordLocation = true) {
    store.categories$.set({
      [FOOD]: category(FOOD, 'Food & Dining', 0),
      [GROCERIES]: category(GROCERIES, 'Groceries', 1),
    });
    financeProjection$.set({
      ...EMPTY_FINANCE_PROJECTION,
      walletsById: { [MAYBANK]: financeWallet({ id: MAYBANK, recordLocation }) },
      transactionsById: Object.fromEntries(rows.map((row) => [row.id, row])),
      transactionsByWallet: { [MAYBANK]: rows.map((row) => row.id) },
    });
  }

  const CHIP = 'At Mamak Ali? · Food & Dining';

  beforeEach(() => seed());

  it('waits for the location, and keeps the amount typed meanwhile', async () => {
    const answer = positionAnswersLater();
    await openPage();
    fireEvent.press(screen.getByTestId('capture.key.7'));
    expect(screen.queryByText(CHIP)).toBeNull();
    await act(async () => answer());
    expect(screen.getByText(CHIP)).toBeTruthy();
    expect(screen.getByLabelText('Amount −RM7')).toBeTruthy();
  });

  it('fills nothing until it is tapped', async () => {
    await openPage();
    expect(screen.getByText(CHIP)).toBeTruthy();
    expect(screen.getByTestId('capture.note').props.value).toBe('');
    const saved = await addExpense();
    expect(saved.merchant).toBeNull();
    expect(saved.categoryId).not.toBe(FOOD);
  });

  it('fills the shop and category on a tap, then goes away', async () => {
    await openPage();
    fireEvent.press(screen.getByTestId('capture.place-chip'));
    expect(screen.getByTestId('capture.note').props.value).toBe('Mamak Ali');
    expect(screen.queryByText(CHIP)).toBeNull();
    expect(await addExpense()).toMatchObject({ merchant: 'Mamak Ali', categoryId: FOOD });
  });

  it('dismisses without filling, and stays dismissed', async () => {
    await openPage();
    fireEvent.press(screen.getByTestId('capture.place-chip.dismiss'));
    expect(screen.queryByText(CHIP)).toBeNull();
    expect(screen.getByTestId('capture.note').props.value).toBe('');
    fireEvent.changeText(screen.getByTestId('capture.note'), 'x');
    fireEvent.changeText(screen.getByTestId('capture.note'), '');
    expect(screen.queryByText(CHIP)).toBeNull();
    expect((await addExpense()).merchant).toBeNull();
  });

  it('gives way once the user types a shop', async () => {
    await openPage();
    fireEvent.changeText(screen.getByTestId('capture.note'), 'Kopitiam');
    expect(screen.queryByText(CHIP)).toBeNull();
    expect((await addExpense()).merchant).toBe('Kopitiam');
  });

  it('goes when the user removes the location from this entry', async () => {
    await openPage();
    fireEvent.press(screen.getByTestId('capture.location'));
    expect(screen.queryByText(CHIP)).toBeNull();
  });

  it('is only for expenses', async () => {
    await openPage();
    fireEvent.press(screen.getByText('Income'));
    expect(screen.queryByText(CHIP)).toBeNull();
    fireEvent.press(screen.getByText('Transfer'));
    expect(screen.queryByText(CHIP)).toBeNull();
    fireEvent.press(screen.getByText('Expense'));
    expect(screen.getByText(CHIP)).toBeTruthy();
  });

  it('never shows without permission, and never asks', async () => {
    permission('denied');
    await openPage();
    expect(screen.queryByText(CHIP)).toBeNull();
    expect(location.requestForegroundPermissionsAsync).not.toHaveBeenCalled();
  });

  it('never shows for a wallet whose app has location off', async () => {
    seed(false);
    await openPage();
    expect(screen.queryByText(CHIP)).toBeNull();
  });

  it('never shows away from the place', async () => {
    location.getCurrentPositionAsync.mockResolvedValue({
      coords: { latitude: 3.2, longitude: 101.671 },
    } as Location.LocationObject);
    await openPage();
    expect(screen.queryByText(CHIP)).toBeNull();
  });
});
