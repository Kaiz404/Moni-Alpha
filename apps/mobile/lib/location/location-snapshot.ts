import * as Location from 'expo-location';

export type LocationSnapshot = {
  latitude: number;
  longitude: number;
  name: string | null;
  capturedAt: string;
};

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
          [first.name, first.street, first.city, first.region]
            .filter(Boolean)
            .join(', ')
            .trim() || null;
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
