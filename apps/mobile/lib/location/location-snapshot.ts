import * as Location from 'expo-location';

export type LocationSnapshot = {
  latitude: number;
  longitude: number;
  name: string | null;
  capturedAt: string;
};

/** Android stops the capture task after 15 s and may freeze the process before then. */
export const HEADLESS_LOCATION_TIMEOUT_MS = 3000;
const LAST_KNOWN_MAX_AGE_MS = 5 * 60_000;

/** With no screen up, Android hands out a position only to an app allowed all the time. */
async function headlessPosition(): Promise<LocationSnapshot | null> {
  const permission = await Location.getBackgroundPermissionsAsync();
  if (permission.status !== 'granted') {
    console.log('[NotifCapture] location skipped: not allowed all the time');
    return null;
  }
  const position =
    (await Location.getLastKnownPositionAsync({ maxAge: LAST_KNOWN_MAX_AGE_MS })) ??
    (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
  return {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
    name: null,
    capturedAt: new Date().toISOString(),
  };
}

/**
 * Where the phone is for a capture with no screen up: it never asks for permission, never waits on
 * the network for a place name, and gives up after `HEADLESS_LOCATION_TIMEOUT_MS`.
 */
export async function captureHeadlessLocationSnapshot(): Promise<LocationSnapshot | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), HEADLESS_LOCATION_TIMEOUT_MS);
  });
  try {
    return await Promise.race([headlessPosition().catch(() => null), timeout]);
  } finally {
    clearTimeout(timer);
  }
}

export async function captureLocationSnapshot(): Promise<LocationSnapshot | null> {
  try {
    const permission = await Location.requestForegroundPermissionsAsync();
    if (permission.status !== 'granted') return null;

    const current = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });

    let locationName: string | null = null;
    try {
      const addresses = await Location.reverseGeocodeAsync({
        latitude: current.coords.latitude,
        longitude: current.coords.longitude,
      });
      const first = addresses[0];
      if (first) {
        locationName =
          [first.name, first.street, first.city, first.region].filter(Boolean).join(', ').trim() ||
          null;
      }
    } catch {
      // Reverse geocode is best effort only.
    }

    return {
      latitude: current.coords.latitude,
      longitude: current.coords.longitude,
      name: locationName,
      capturedAt: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}
