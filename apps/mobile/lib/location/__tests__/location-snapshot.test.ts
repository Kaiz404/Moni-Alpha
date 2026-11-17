import * as Location from 'expo-location';

import {
  captureHeadlessLocationSnapshot,
  HEADLESS_LOCATION_TIMEOUT_MS,
} from '../location-snapshot';

jest.mock('expo-location', () => ({
  Accuracy: { Balanced: 3 },
  getForegroundPermissionsAsync: jest.fn(),
  requestForegroundPermissionsAsync: jest.fn(),
  getLastKnownPositionAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
  reverseGeocodeAsync: jest.fn(),
}));

const coords = (latitude: number, longitude: number) => ({ coords: { latitude, longitude } });

beforeEach(() => {
  jest.useFakeTimers({ now: Date.parse('2026-11-18T08:00:00.000Z') });
  jest.clearAllMocks();
  jest
    .mocked(Location.getForegroundPermissionsAsync)
    .mockResolvedValue({ status: 'granted' } as never);
});

afterEach(() => jest.useRealTimers());

describe('captureHeadlessLocationSnapshot', () => {
  it('takes a recent last known position without asking or naming the place', async () => {
    jest.mocked(Location.getLastKnownPositionAsync).mockResolvedValue(coords(3.1, 101.6) as never);

    await expect(captureHeadlessLocationSnapshot()).resolves.toEqual({
      latitude: 3.1,
      longitude: 101.6,
      name: null,
      capturedAt: '2026-11-18T08:00:00.000Z',
    });
    expect(Location.requestForegroundPermissionsAsync).not.toHaveBeenCalled();
    expect(Location.reverseGeocodeAsync).not.toHaveBeenCalled();
    expect(Location.getCurrentPositionAsync).not.toHaveBeenCalled();
  });

  it('gives up on a fix that never comes', async () => {
    jest.mocked(Location.getLastKnownPositionAsync).mockResolvedValue(null);
    jest.mocked(Location.getCurrentPositionAsync).mockReturnValue(new Promise(() => {}));

    const snapshot = captureHeadlessLocationSnapshot();
    await jest.advanceTimersByTimeAsync(HEADLESS_LOCATION_TIMEOUT_MS);

    await expect(snapshot).resolves.toBeNull();
  });

  it('records nothing when location access was never given', async () => {
    jest
      .mocked(Location.getForegroundPermissionsAsync)
      .mockResolvedValue({ status: 'denied' } as never);

    await expect(captureHeadlessLocationSnapshot()).resolves.toBeNull();
    expect(Location.requestForegroundPermissionsAsync).not.toHaveBeenCalled();
  });
});
