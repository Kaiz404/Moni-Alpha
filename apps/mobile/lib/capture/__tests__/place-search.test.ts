import type { CurrencyCode } from '@repo/types';

import { nearPlaces, searchPastPlaces, searchRows } from '@/lib/capture/place-search';
import type { FinanceTransaction } from '@/lib/finance/types';
import { expense } from '@/lib/wallets/__tests__/balance-fixture';

const MYR = 'MYR' as CurrencyCode;
const LNG = 101.671;
const BANGSAR = 3.13;
const MONT_KIARA = 3.17;
const OWN = { source: 'own', placeId: null };
const METRE_LAT = 1 / 111_320;

const paid = (
  id: string,
  day: number,
  latitude: number,
  merchant: string,
  locationName: string | null,
): FinanceTransaction =>
  expense(id, new Date(2026, 9, day, 12).toISOString(), {
    merchant,
    locationLatitude: latitude,
    locationLongitude: LNG,
    locationName,
  });

const rows = [
  paid('a', 4, BANGSAR, 'Mamak Ali', 'Jalan Telawi 3, Bangsar, Kuala Lumpur, Wilayah Persekutuan'),
  paid('b', 3, BANGSAR, 'MAMAK ALI 0042', 'Jalan Telawi 3, Bangsar, Kuala Lumpur, Wilayah Persekutuan'),
  paid('c', 2, BANGSAR, 'Jaya Grocer', 'Jalan Telawi 3, Bangsar, Kuala Lumpur, Wilayah Persekutuan'),
  paid('d', 1, MONT_KIARA, 'Mamak Corner', 'Plaza Mont Kiara, Kuala Lumpur, Wilayah Persekutuan'),
];

const search = (query: string, aliases: { rawKey: string; displayName: string }[] = []) =>
  searchPastPlaces(query, { transactions: rows, currency: MYR, aliases });

describe('searching past places', () => {
  it('finds shops by name, most visited first, at the place they were paid', () => {
    expect(search('mamak')).toEqual([
      {
        id: `${BANGSAR.toFixed(4)},${LNG.toFixed(4)}:mamak ali`,
        latitude: BANGSAR,
        longitude: LNG,
        title: 'Mamak Ali',
        meta: 'Jalan Telawi 3',
        shop: 'Mamak Ali',
        categoryId: null,
        coords: OWN,
      },
      {
        id: `${MONT_KIARA.toFixed(4)},${LNG.toFixed(4)}:mamak corner`,
        latitude: MONT_KIARA,
        longitude: LNG,
        title: 'Mamak Corner',
        meta: 'Plaza Mont Kiara',
        shop: 'Mamak Corner',
        categoryId: null,
        coords: OWN,
      },
    ]);
  });

  it('uses the name the user gave a merchant', () => {
    expect(
      search('ali', [{ rawKey: 'mamak ali', displayName: 'Ali the Mamak' }]).map(
        (option) => option.title,
      ),
    ).toEqual(['Ali the Mamak']);
  });

  it('finds a place by its street when no shop there matches', () => {
    expect(search('mont kiara')).toEqual([
      {
        id: `${MONT_KIARA.toFixed(4)},${LNG.toFixed(4)}`,
        latitude: MONT_KIARA,
        longitude: LNG,
        title: 'Plaza Mont Kiara',
        meta: 'Kuala Lumpur',
        shop: null,
        categoryId: null,
        coords: OWN,
      },
    ]);
  });

  it('finds nothing for an empty query', () => {
    expect(search('  ')).toEqual([]);
    expect(search('jaya')).toHaveLength(1);
  });
});

describe('Near you, before the user types', () => {
  const input = { transactions: rows, currency: MYR, aliases: [] };

  it("lists the user's places within 500 m, nearest first, under their most visited shop", () => {
    const centre = { latitude: BANGSAR + 120 * METRE_LAT, longitude: LNG };
    expect(nearPlaces(centre, input).map(({ title, meta, shop }) => ({ title, meta, shop }))).toEqual([
      { title: 'Mamak Ali', meta: '120 m · 2 visits', shop: 'Mamak Ali' },
    ]);
  });

  it('lists nothing far from every place, or with no centre', () => {
    expect(nearPlaces({ latitude: BANGSAR + 600 * METRE_LAT, longitude: LNG }, input)).toEqual([]);
    expect(nearPlaces(null, input)).toEqual([]);
  });

  it("reuses a Google position with its fetch time, so its 30 days don't restart", () => {
    const google = expense('g', new Date(2026, 9, 1, 12).toISOString(), {
      merchant: 'Village Park',
      locationLatitude: 3.1356,
      locationLongitude: 101.6237,
      placeId: 'ChIJvillage',
      placeCoordsAt: '2026-10-01T04:00:00.000Z',
    });
    const [near] = nearPlaces(
      { latitude: 3.1356, longitude: 101.6237 },
      { ...input, transactions: [google] },
    );
    expect(near.meta).toBe('1 visit');
    expect(near.coords).toEqual({
      source: 'google',
      placeId: 'ChIJvillage',
      fetchedAt: '2026-10-01T04:00:00.000Z',
    });
  });
});

describe('the search list', () => {
  const own = search('jaya');
  const address = {
    id: 'geocode-0',
    latitude: 3.1,
    longitude: 101.6,
    title: 'jaya',
    meta: 'Address search',
    shop: null,
    categoryId: null,
    coords: OWN,
  } as const;
  const prediction = (placeId: string) => ({
    placeId,
    primaryText: 'Jaya Grocer',
    secondaryText: 'Bangsar Village',
    distanceMeters: 300,
  });
  const kinds = (rows: ReturnType<typeof searchRows>) =>
    rows.map((row) => (row.kind === 'google' ? `google:${row.prediction.placeId}` : row.kind));

  it("puts the user's places first, then Google's", () => {
    expect(
      kinds(
        searchRows({
          own,
          google: { status: 'done', query: 'jaya', predictions: [prediction('p1'), prediction('p2')] },
          addresses: [address],
        }),
      ),
    ).toEqual(['own', 'google:p1', 'google:p2']);
  });

  it('falls back to addresses only when Google is unavailable or finds nothing', () => {
    expect(
      kinds(searchRows({ own, google: { status: 'unavailable', query: 'jaya' }, addresses: [address] })),
    ).toEqual(['own', 'address']);
    expect(
      kinds(
        searchRows({ own: [], google: { status: 'done', query: 'jaya', predictions: [] }, addresses: [address] }),
      ),
    ).toEqual(['address']);
    expect(
      kinds(searchRows({ own, google: { status: 'loading', query: 'jaya' }, addresses: [address] })),
    ).toEqual(['own']);
  });

  it('leaves out a Google place the user already has', () => {
    const mine = [{ ...own[0], coords: { source: 'own', placeId: 'p1' } as const }];
    expect(
      kinds(
        searchRows({
          own: mine,
          google: { status: 'done', query: 'jaya', predictions: [prediction('p1'), prediction('p2')] },
          addresses: [],
        }),
      ),
    ).toEqual(['own', 'google:p2']);
  });
});
