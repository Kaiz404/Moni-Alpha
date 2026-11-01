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
import { financeWallet } from '@/lib/wallets/__tests__/balance-fixture';

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
