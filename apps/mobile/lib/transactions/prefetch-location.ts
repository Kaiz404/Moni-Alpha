import * as Location from 'expo-location';

export type TransactionLocationSnapshot = {
  latitude: number;
  longitude: number;
  name: string | null;
};

/** What Type it knows about where the phone is. `none` means nothing can be saved. */
export type EntryLocation =
  | { status: 'none' }
  | { status: 'finding' }
  | { status: 'found'; location: TransactionLocationSnapshot };

async function placeName(position: {
  latitude: number;
  longitude: number;
}): Promise<string | null> {
  try {
    const [first] = await Location.reverseGeocodeAsync(position);
    if (!first) return null;
    return (
      [first.name, first.street, first.city, first.region]
        .filter(Boolean)
        .join(', ')
        .trim() || null
    );
  } catch {
    return null;
  }
}

/**
 * Best-effort position for a new transaction, reported as it firms up: coordinates first, then
 * the place name. Only reads a permission the user already gave; it never asks.
 */
export async function prefetchTransactionLocation(
  onChange: (location: EntryLocation) => void,
): Promise<void> {
  try {
    const permission = await Location.getForegroundPermissionsAsync();
    if (permission.status !== 'granted') {
      onChange({ status: 'none' });
      return;
    }
    onChange({ status: 'finding' });
    const { coords } = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    const position = {
      latitude: coords.latitude,
      longitude: coords.longitude,
    };
    onChange({ status: 'found', location: { ...position, name: null } });
    const name = await placeName(position);
    if (name) onChange({ status: 'found', location: { ...position, name } });
  } catch {
    onChange({ status: 'none' });
  }
}
