import type { CurrencyCode } from '@repo/types';

import { searchPastPlaces } from '@/lib/capture/place-search';
import type { FinanceTransaction } from '@/lib/finance/types';
import { expense } from '@/lib/wallets/__tests__/balance-fixture';

const MYR = 'MYR' as CurrencyCode;
const LNG = 101.671;
const BANGSAR = 3.13;
const MONT_KIARA = 3.17;

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
      },
      {
        id: `${MONT_KIARA.toFixed(4)},${LNG.toFixed(4)}:mamak corner`,
        latitude: MONT_KIARA,
        longitude: LNG,
        title: 'Mamak Corner',
        meta: 'Plaza Mont Kiara',
        shop: 'Mamak Corner',
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
      },
    ]);
  });

  it('finds nothing for an empty query', () => {
    expect(search('  ')).toEqual([]);
    expect(search('jaya')).toHaveLength(1);
  });
});
