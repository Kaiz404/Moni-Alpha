import * as Location from 'expo-location';

export type TransactionLocationSnapshot = {
  latitude: number;
  longitude: number;
  name: string | null;
};

/** Best-effort current location for attaching to a new transaction. */
export async function prefetchTransactionLocation(): Promise<TransactionLocationSnapshot | null> {
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
          [first.name, first.street, first.city, first.region]
            .filter(Boolean)
            .join(', ')
            .trim() || null;
      }
    } catch {
      // keep coords without a label
    }

    return {
      latitude: current.coords.latitude,
      longitude: current.coords.longitude,
      name: locationName,
    };
  } catch {
    return null;
  }
}
