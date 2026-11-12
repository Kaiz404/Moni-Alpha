import 'react-native-gesture-handler/jestSetup';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import type { CurrencyCode } from '@repo/types';
import * as Location from 'expo-location';

import { SheetHost } from '@/components/ui/sheet/sheet-host';
import type { PlacePick } from '@/lib/capture/entry-place';
import type { AutocompleteResult, DetailsResult } from '@/lib/places/types';
import { dismissSheet, openSheet } from '@/lib/sheet/sheet-store';
import { expense } from '@/lib/wallets/__tests__/balance-fixture';

const mockClient = {
  autocomplete: jest.fn<Promise<AutocompleteResult>, unknown[]>(),
  details: jest.fn<Promise<DetailsResult>, unknown[]>(),
};
const mockPermission = { granted: false, canAskAgain: true };
const mockRequest = jest.fn();

jest.mock('@/lib/places/client', () => ({ getPlacesClient: () => mockClient }));
jest.mock('@/components/map/maps-available', () => ({ mapsAvailable: () => true }));
let mockSession = 0;
jest.mock('expo-crypto', () => ({ randomUUID: () => `session-${++mockSession}` }));
jest.mock('expo-location', () => ({
  Accuracy: { Balanced: 3 },
  useForegroundPermissions: () => [mockPermission, mockRequest],
  getCurrentPositionAsync: jest.fn(),
  reverseGeocodeAsync: jest.fn(async () => [{ name: 'Jalan Telawi 5', city: 'Kuala Lumpur' }]),
  geocodeAsync: jest.fn(async () => []),
}));
jest.mock('@/lib/haptics', () => ({ scrubStep: jest.fn() }));
jest.mock('uniwind', () => ({
  useCSSVariable: (names: string[]) => names.map(() => undefined),
  useUniwind: () => ({ theme: 'light' }),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('react-native-reanimated', () => ({
  ...jest.requireActual<object>('react-native-reanimated/mock'),
  useReducedMotion: () => false,
  useAnimatedKeyboard: () => ({ height: { get: () => 0 }, state: { get: () => 0 } }),
}));

const METRE_LAT = 1 / 111_320;
const START = {
  latitude: 3.13,
  longitude: 101.671,
  name: 'Jalan Telawi 3, Kuala Lumpur',
  coords: { source: 'own', placeId: null } as const,
};
const PAST = {
  currency: 'MYR' as CurrencyCode,
  aliases: [],
  transactions: [
    expense('t1', '2026-10-01T04:00:00.000Z', {
      merchant: 'Mamak Ali',
      locationLatitude: START.latitude + 120 * METRE_LAT,
      locationLongitude: START.longitude,
      locationName: 'Mamak Ali',
    }),
  ],
};
const JAYA = {
  placeId: 'p-jaya',
  primaryText: 'Jaya Grocer',
  secondaryText: 'Bangsar Village',
  distanceMeters: 0,
};

let answer: Promise<PlacePick | null>;

async function openPlaceSheet() {
  render(<SheetHost />);
  act(() => {
    answer = openSheet({ kind: 'place', start: START, past: PAST });
  });
  await act(async () => {});
}

async function type(text: string) {
  fireEvent.changeText(screen.getByTestId('sheet.place.search'), text);
  await waitFor(() => expect(mockClient.autocomplete).toHaveBeenCalled(), { timeout: 1500 });
  await act(async () => {});
}

beforeEach(() => {
  jest.clearAllMocks();
  mockSession = 0;
  mockPermission.granted = false;
  mockClient.autocomplete.mockResolvedValue({ status: 'ok', predictions: [JAYA] });
  mockClient.details.mockResolvedValue({
    status: 'ok',
    place: { placeId: 'p-jaya', latitude: 3.1306, longitude: 101.6705, address: null },
  });
});

afterEach(async () => {
  act(() => dismissSheet());
  await act(() => new Promise((resolve) => setTimeout(resolve, 0)));
});

describe('the place sheet', () => {
  it("opens on the user's own places near the map, without asking Google", async () => {
    await openPlaceSheet();
    expect(screen.getByText('Near you')).toBeTruthy();
    expect(screen.getByLabelText('Mamak Ali, 120 m · 1 visit')).toBeTruthy();
    expect(mockClient.autocomplete).not.toHaveBeenCalled();
    fireEvent.press(screen.getByLabelText('Mamak Ali, 120 m · 1 visit'));
    expect(screen.getByTestId('sheet.place.name').props.children).toBe('Mamak Ali');
    expect(screen.getByText('Choose a place')).toBeTruthy();
    fireEvent.press(screen.getByTestId('sheet.place.confirm'));
    await expect(answer).resolves.toEqual({
      kind: 'chosen',
      place: {
        latitude: START.latitude + 120 * METRE_LAT,
        longitude: START.longitude,
        name: 'Mamak Ali',
        coords: { source: 'own', placeId: null },
      },
      shop: 'Mamak Ali',
    });
  });

  it('selects a Google place, shows it on the map, and saves it on Confirm, hiding a 0 m distance', async () => {
    await openPlaceSheet();
    await type('jaya');
    expect(mockClient.autocomplete).toHaveBeenCalledWith(
      {
        input: 'jaya',
        sessionToken: 'session-1',
        bias: { latitude: START.latitude, longitude: START.longitude },
      },
      expect.anything(),
    );
    const row = await screen.findByLabelText('Jaya Grocer, Bangsar Village');
    fireEvent.press(row);
    await waitFor(() =>
      expect(screen.getByTestId('sheet.place.name').props.children).toBe('Jaya Grocer'),
    );
    fireEvent.press(screen.getByTestId('sheet.place.confirm'));
    const pick = await answer;
    expect(mockClient.details).toHaveBeenCalledWith({ placeId: 'p-jaya', sessionToken: 'session-1' });
    expect(pick).toEqual({
      kind: 'chosen',
      place: {
        latitude: 3.1306,
        longitude: 101.6705,
        name: 'Jaya Grocer',
        coords: { source: 'google', placeId: 'p-jaya', fetchedAt: expect.any(String) },
      },
      shop: 'Jaya Grocer',
    });
  });

  it('closes search from its X and keeps the results, and clears them from the X once closed', async () => {
    await openPlaceSheet();
    fireEvent(screen.getByTestId('sheet.place.search'), 'focus');
    await type('jaya');
    fireEvent.press(screen.getByLabelText('Close search'));
    fireEvent(screen.getByTestId('sheet.place.search'), 'blur');
    expect(screen.getByTestId('sheet.place.search').props.value).toBe('jaya');
    expect(screen.getByLabelText('Jaya Grocer, Bangsar Village')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Clear search'));
    expect(screen.getByTestId('sheet.place.search').props.value).toBe('');
    expect(screen.getByText('Near you')).toBeTruthy();
  });

  it('starts a new Google session for the next search once a place is opened', async () => {
    await openPlaceSheet();
    await type('jaya');
    const first = mockClient.autocomplete.mock.calls[0][0].sessionToken;
    fireEvent.press(await screen.findByLabelText('Jaya Grocer, Bangsar Village'));
    await waitFor(() => expect(mockClient.details).toHaveBeenCalledWith({ placeId: 'p-jaya', sessionToken: first }));
    mockClient.autocomplete.mockClear();
    await type('zus');
    expect(mockClient.autocomplete).toHaveBeenCalledTimes(1);
    expect(mockClient.autocomplete.mock.calls[0][0].sessionToken).not.toBe(first);
  });

  it('stays open with a note on the row when Google cannot open the place', async () => {
    mockClient.details.mockResolvedValue({ status: 'unavailable' });
    await openPlaceSheet();
    await type('jaya');
    fireEvent.press(await screen.findByLabelText('Jaya Grocer, Bangsar Village'));
    expect(
      await screen.findByLabelText("Jaya Grocer, Couldn't open this place. Try again."),
    ).toBeTruthy();
    expect(screen.getByText('Choose a place')).toBeTruthy();
  });

  it('goes to the phone from the my-location button, asking once, then waits for Confirm', async () => {
    mockRequest.mockResolvedValue({ granted: true });
    jest.mocked(Location.getCurrentPositionAsync).mockResolvedValue({
      coords: { latitude: 3.14, longitude: 101.68 },
    } as Location.LocationObject);
    await openPlaceSheet();
    await act(async () => {
      fireEvent.press(screen.getByTestId('sheet.place.my-location'));
    });
    expect(mockRequest).toHaveBeenCalledTimes(1);
    expect(await screen.findByText('Jalan Telawi 5')).toBeTruthy();
    fireEvent.press(screen.getByTestId('sheet.place.confirm'));
    await expect(answer).resolves.toEqual({
      kind: 'chosen',
      place: {
        latitude: 3.14,
        longitude: 101.68,
        name: 'Jalan Telawi 5, Kuala Lumpur',
        coords: { source: 'own', placeId: null },
      },
      shop: null,
    });
  });
});
