import { placeColumns, type SavedPlace } from '@/lib/places/coords';

const METRE_LAT = 1 / 111_320;
const FETCHED = '2026-11-12T03:00:00.000Z';
const GOOGLE: SavedPlace = {
  latitude: 3.118,
  longitude: 101.677,
  name: 'Village Park Restaurant',
  coords: { source: 'google', placeId: 'ChIJvillage', fetchedAt: FETCHED },
};
const phoneAt = (metres: number) => ({
  latitude: GOOGLE.latitude + metres * METRE_LAT,
  longitude: GOOGLE.longitude,
});

describe('the columns saved for a Google place', () => {
  it("keeps the phone's position when the phone is within 150 m, under the user's words", () => {
    expect(
      placeColumns(GOOGLE, { phone: phoneAt(140), note: ' Nasi lemak ', placeIdsReady: true }),
    ).toEqual({
      locationLatitude: GOOGLE.latitude + 140 * METRE_LAT,
      locationLongitude: 101.677,
      locationName: 'Nasi lemak',
      placeId: 'ChIJvillage',
      placeCoordsAt: null,
    });
  });

  it("keeps Google's position with when it was fetched once the phone is farther", () => {
    expect(
      placeColumns(GOOGLE, { phone: phoneAt(160), note: 'Village Park', placeIdsReady: true }),
    ).toEqual({
      locationLatitude: 3.118,
      locationLongitude: 101.677,
      locationName: 'Village Park',
      placeId: 'ChIJvillage',
      placeCoordsAt: FETCHED,
    });
  });

  it("never saves Google's name on its own", () => {
    expect(
      placeColumns(GOOGLE, { phone: null, note: '  ', placeIdsReady: true }).locationName,
    ).toBeNull();
  });

  it("keeps no Google position before the server can hold its place ID", () => {
    expect(
      placeColumns(GOOGLE, { phone: null, note: 'Village Park', placeIdsReady: false }),
    ).toEqual({ locationName: 'Village Park' });
    expect(
      placeColumns(GOOGLE, { phone: phoneAt(10), note: 'Village Park', placeIdsReady: false }),
    ).toEqual({
      locationLatitude: GOOGLE.latitude + 10 * METRE_LAT,
      locationLongitude: 101.677,
      locationName: 'Village Park',
    });
  });
});

describe("the columns saved for the user's own place", () => {
  const PINNED: SavedPlace = {
    latitude: 3.13,
    longitude: 101.671,
    name: 'Jalan Telawi 3, Kuala Lumpur',
    coords: { source: 'own', placeId: null },
  };

  it('keeps its position and name for good', () => {
    expect(
      placeColumns(PINNED, { phone: phoneAt(5000), note: 'Teh tarik', placeIdsReady: true }),
    ).toEqual({
      locationLatitude: 3.13,
      locationLongitude: 101.671,
      locationName: 'Jalan Telawi 3, Kuala Lumpur',
      placeId: null,
      placeCoordsAt: null,
    });
  });

  it('writes no place columns before the migration', () => {
    expect(
      placeColumns(PINNED, { phone: null, note: '', placeIdsReady: false }),
    ).toEqual({
      locationLatitude: 3.13,
      locationLongitude: 101.671,
      locationName: 'Jalan Telawi 3, Kuala Lumpur',
    });
  });
});
