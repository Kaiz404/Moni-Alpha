import * as Location from 'expo-location';

import {
  prefetchTransactionLocation,
  type EntryLocation,
} from '@/lib/transactions/prefetch-location';

jest.mock('expo-location', () => ({
  Accuracy: { Balanced: 3 },
  getForegroundPermissionsAsync: jest.fn(),
  requestForegroundPermissionsAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
  reverseGeocodeAsync: jest.fn(),
}));

const location = jest.mocked(Location);
const POSITION = { latitude: 3.13, longitude: 101.671 };
const OWN = { source: 'own', placeId: null };

async function run(): Promise<EntryLocation[]> {
  const updates: EntryLocation[] = [];
  await prefetchTransactionLocation((update) => updates.push(update));
  return updates;
}

function granted(status: 'granted' | 'denied' | 'undetermined') {
  location.getForegroundPermissionsAsync.mockResolvedValue({
    status,
  } as Location.LocationPermissionResponse);
}

beforeEach(() => {
  jest.clearAllMocks();
  location.getCurrentPositionAsync.mockResolvedValue({
    coords: POSITION,
  } as Location.LocationObject);
  location.reverseGeocodeAsync.mockResolvedValue([
    { name: 'Jalan Telawi 3', street: null, city: 'Kuala Lumpur', region: null },
  ] as Location.LocationGeocodedAddress[]);
});

describe('the location for a new transaction', () => {
  it.each(['denied', 'undetermined'] as const)(
    'with permission %s, reports none and never asks or reads the position',
    async (status) => {
      granted(status);
      expect(await run()).toEqual([{ status: 'none' }]);
      expect(location.requestForegroundPermissionsAsync).not.toHaveBeenCalled();
      expect(location.getCurrentPositionAsync).not.toHaveBeenCalled();
    },
  );

  it('reports the coordinates before the place name arrives', async () => {
    granted('granted');
    expect(await run()).toEqual([
      { status: 'finding' },
      { status: 'found', location: { ...POSITION, name: null, coords: OWN } },
      {
        status: 'found',
        location: { ...POSITION, name: 'Jalan Telawi 3, Kuala Lumpur', coords: OWN },
      },
    ]);
    expect(location.requestForegroundPermissionsAsync).not.toHaveBeenCalled();
  });

  it('keeps the coordinates when the place name fails', async () => {
    granted('granted');
    location.reverseGeocodeAsync.mockRejectedValue(new Error('offline'));
    expect(await run()).toEqual([
      { status: 'finding' },
      { status: 'found', location: { ...POSITION, name: null, coords: OWN } },
    ]);
  });

  it('falls back to none when the phone cannot give a position', async () => {
    granted('granted');
    location.getCurrentPositionAsync.mockRejectedValue(new Error('location off'));
    expect(await run()).toEqual([{ status: 'finding' }, { status: 'none' }]);
  });
});
