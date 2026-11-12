import { distanceM, type LatLng } from '@/lib/finance/places';

/**
 * Where a place's coordinates came from. `own` is the user's: the phone's position, a spot they
 * pinned on the map, the device geocoder, or a place from their own history. Kept forever.
 * `google` came from Google (a place's details or a shop tapped on the map) at `fetchedAt`;
 * Google allows keeping them 30 days, so they are refreshed by `placeId` or dropped.
 */
export type PlaceCoords =
  | { source: 'own'; placeId: string | null }
  | { source: 'google'; placeId: string; fetchedAt: string };

export const OWN_COORDS: PlaceCoords = { source: 'own', placeId: null };

/** A Google point and the phone this close are the same place, so the phone's position is kept. */
export const SAME_PLACE_M = 150;

export type SavedPlace = LatLng & { name: string | null; coords: PlaceCoords };

export type PlaceColumns = {
  locationLatitude?: number | null;
  locationLongitude?: number | null;
  locationName?: string | null;
  placeId?: string | null;
  placeCoordsAt?: string | null;
};

export type PlaceColumnsContext = {
  /** The phone's position, when it may stand for this entry. */
  phone: LatLng | null;
  /** Shop or note at save time: the name a Google place is saved under. */
  note: string;
  /** The server has `place_id` and `place_coords_at`. */
  placeIdsReady: boolean;
};

/**
 * The transaction columns for a saved place. A Google pick is saved under the user's own words,
 * never Google's name, and at the phone's position when the phone is within `SAME_PLACE_M` of it.
 * Otherwise Google's coordinates are saved with when they were fetched, so they can be refreshed.
 */
export function placeColumns(
  place: SavedPlace | null,
  { phone, note, placeIdsReady }: PlaceColumnsContext,
): PlaceColumns {
  if (!place) return {};
  const { coords } = place;
  if (coords.source === 'own')
    return {
      locationLatitude: place.latitude,
      locationLongitude: place.longitude,
      locationName: place.name,
      ...(placeIdsReady ? { placeId: coords.placeId, placeCoordsAt: null } : {}),
    };
  const name = note.trim() || null;
  const ids = (placeCoordsAt: string | null) =>
    placeIdsReady ? { placeId: coords.placeId, placeCoordsAt } : {};
  if (phone && distanceM(phone, place) <= SAME_PLACE_M)
    return {
      locationLatitude: phone.latitude,
      locationLongitude: phone.longitude,
      locationName: name,
      ...ids(null),
    };
  // Without the place ID column, Google's coordinates could never be refreshed, so none are kept.
  if (!placeIdsReady) return { locationName: name };
  return {
    locationLatitude: place.latitude,
    locationLongitude: place.longitude,
    locationName: name,
    ...ids(coords.fetchedAt),
  };
}
