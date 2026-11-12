import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import * as Location from 'expo-location';

import TypeItScreen from '@/app/transaction/new';
import type { PlacePick } from '@/lib/capture/entry-place';
import { financeProjection$ } from '@/lib/finance/projection';
import { EMPTY_FINANCE_PROJECTION } from '@/lib/finance/types';
import { getOpenSheet } from '@/lib/sheet/sheet-store';
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
  toggleOn: jest.fn(),
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

/** Opens the place sheet from the Location field, answers it as the user would, and returns where the map opened. */
async function pickInSheet(pick: PlacePick) {
  fireEvent.press(screen.getByTestId('capture.location'));
  const sheet = getOpenSheet();
  if (sheet?.kind !== 'place') throw new Error('the place sheet did not open');
  await act(async () => sheet.settle(pick));
  return sheet.request.start;
}

const SHOP = { latitude: 3.1301, longitude: 101.6712, name: 'Mamak Ali' };

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
    expect(screen.getByLabelText('Location, Finding')).toBeTruthy();
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

  it('opens the place sheet at the phone, and No place takes it off this entry', async () => {
    await openPage();
    expect(await pickInSheet({ kind: 'off' })).toEqual({
      latitude: 3.13,
      longitude: 101.671,
      name: 'Jalan Telawi 3, Kuala Lumpur, Wilayah Persekutuan',
    });
    expect(screen.getByText('Not saved')).toBeTruthy();
    const saved = await addExpense();
    expect(saved.locationLatitude ?? null).toBeNull();
    expect(saved.locationName ?? null).toBeNull();
  });

  it('saves a shop picked on the map and fills an empty Shop or note', async () => {
    await openPage();
    await pickInSheet({ kind: 'chosen', place: SHOP, shop: 'Mamak Ali' });
    expect(screen.getByTestId('capture.note').props.value).toBe('Mamak Ali');
    expect(await addExpense()).toMatchObject({
      merchant: 'Mamak Ali',
      locationLatitude: 3.1301,
      locationLongitude: 101.6712,
      locationName: 'Mamak Ali',
    });
  });

  it('keeps what the user typed when the pick is a street', async () => {
    await openPage();
    fireEvent.changeText(screen.getByTestId('capture.note'), 'Teh tarik');
    await pickInSheet({
      kind: 'chosen',
      place: { ...SHOP, name: 'Jalan Telawi 5' },
      shop: null,
    });
    expect(screen.getByText('Jalan Telawi 5')).toBeTruthy();
    expect(await addExpense()).toMatchObject({
      merchant: 'Teh tarik',
      locationName: 'Jalan Telawi 5',
    });
  });

  it('changes nothing when the sheet closes', async () => {
    await openPage();
    fireEvent.press(screen.getByTestId('capture.location'));
    const sheet = getOpenSheet();
    await act(async () => sheet?.settle(null));
    expect(screen.getByText('Jalan Telawi 3')).toBeTruthy();
    expect(await addExpense()).toMatchObject({ locationLatitude: 3.13 });
  });

  it('stays off when it is turned off before the position arrives', async () => {
    const answer = positionAnswersLater();
    await openPage();
    await pickInSheet({ kind: 'off' });
    await act(async () => answer());
    expect(screen.getByText('Not saved')).toBeTruthy();
    expect((await addExpense()).locationLatitude ?? null).toBeNull();
  });

  it('never asks without permission, saves nothing, and still lets the user pick', async () => {
    permission('denied');
    await openPage();
    expect(screen.getByLabelText('Location, Add place')).toBeTruthy();
    expect(location.requestForegroundPermissionsAsync).not.toHaveBeenCalled();
    expect(location.getCurrentPositionAsync).not.toHaveBeenCalled();
    expect(
      await pickInSheet({ kind: 'chosen', place: SHOP, shop: 'Mamak Ali' }),
    ).toBeNull();
    expect(await addExpense()).toMatchObject({ locationLatitude: 3.1301 });
  });

  it('saves no phone position for a wallet whose app has location off', async () => {
    seedWallet(false);
    await openPage();
    expect(screen.getByLabelText('Location, Add place')).toBeTruthy();
    expect((await addExpense()).locationLatitude ?? null).toBeNull();
  });

  it('saves a place picked for a wallet whose app has location off', async () => {
    seedWallet(false);
    await openPage();
    await pickInSheet({ kind: 'chosen', place: SHOP, shop: 'Mamak Ali' });
    expect(await addExpense()).toMatchObject({ locationName: 'Mamak Ali' });
  });

  it('has no location on a transfer', async () => {
    await openPage();
    fireEvent.press(screen.getByText('Transfer'));
    expect(screen.queryByTestId('capture.location')).toBeNull();
  });
});

describe('Type it place offer', () => {
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

  const ACCEPT = 'capture.location.accept';
  const offered = () => screen.queryByTestId(ACCEPT) !== null;

  beforeEach(() => seed());

  it('waits for the location, and keeps the amount typed meanwhile', async () => {
    const answer = positionAnswersLater();
    await openPage();
    fireEvent.press(screen.getByTestId('capture.key.7'));
    expect(offered()).toBe(false);
    await act(async () => answer());
    expect(screen.getByText('Been here?')).toBeTruthy();
    expect(screen.getByLabelText('Use Mamak Ali, Food & Dining')).toBeTruthy();
    expect(screen.getByLabelText('Amount −RM7')).toBeTruthy();
  });

  it('fills nothing until it is accepted', async () => {
    await openPage();
    expect(offered()).toBe(true);
    expect(screen.getByTestId('capture.note').props.value).toBe('');
    const saved = await addExpense();
    expect(saved.merchant).toBeNull();
    expect(saved.categoryId).not.toBe(FOOD);
    expect(saved.locationName).toBe(
      'Jalan Telawi 3, Kuala Lumpur, Wilayah Persekutuan',
    );
  });

  it('fills the shop, category and place on the check, then goes away', async () => {
    await openPage();
    fireEvent.press(screen.getByTestId(ACCEPT));
    expect(screen.getByTestId('capture.note').props.value).toBe('Mamak Ali');
    expect(offered()).toBe(false);
    expect(screen.getByLabelText('Location, Mamak Ali')).toBeTruthy();
    expect(await addExpense()).toMatchObject({
      merchant: 'Mamak Ali',
      categoryId: FOOD,
      locationLatitude: 3.13,
      locationLongitude: 101.671,
      locationName: 'Mamak Ali',
    });
  });

  it('gives way once the user types a shop', async () => {
    await openPage();
    fireEvent.changeText(screen.getByTestId('capture.note'), 'Kopitiam');
    expect(offered()).toBe(false);
    expect((await addExpense()).merchant).toBe('Kopitiam');
  });

  it('goes when the user picks No place', async () => {
    await openPage();
    await pickInSheet({ kind: 'off' });
    expect(offered()).toBe(false);
  });

  it('is only for expenses', async () => {
    await openPage();
    fireEvent.press(screen.getByText('Income'));
    expect(offered()).toBe(false);
    fireEvent.press(screen.getByText('Transfer'));
    expect(offered()).toBe(false);
    fireEvent.press(screen.getByText('Expense'));
    expect(offered()).toBe(true);
  });

  it('never shows without permission, and never asks', async () => {
    permission('denied');
    await openPage();
    expect(offered()).toBe(false);
    expect(location.requestForegroundPermissionsAsync).not.toHaveBeenCalled();
  });

  it('never shows for a wallet whose app has location off', async () => {
    seed(false);
    await openPage();
    expect(offered()).toBe(false);
  });

  it('never shows away from the place', async () => {
    location.getCurrentPositionAsync.mockResolvedValue({
      coords: { latitude: 3.2, longitude: 101.671 },
    } as Location.LocationObject);
    await openPage();
    expect(offered()).toBe(false);
  });
});
