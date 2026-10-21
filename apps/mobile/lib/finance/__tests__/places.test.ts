import type { MinorAmount } from '@repo/types';

import type { FinanceTransaction } from '../types';
import {
  clusterPins,
  groupPlaces,
  placeLabel,
  placeRanges,
  placeRegular,
  spanLabel,
} from '../places';

const MAMAK = { latitude: 3.13035, longitude: 101.67112 };
const KLCC = { latitude: 3.15785, longitude: 101.71162 };
const METRE_LAT = 1 / 111_320;

function row(
  id: string,
  at: { latitude: number; longitude: number } | null,
  amountMinor: number,
  overrides: Partial<FinanceTransaction> = {},
): FinanceTransaction {
  return {
    id,
    userId: 'u1',
    walletId: 'cash',
    amountMinor: amountMinor as MinorAmount,
    currency: 'MYR',
    type: 'expense',
    analysisExcluded: false,
    debtActivityId: null,
    categoryId: 'food',
    transferToWalletId: null,
    linkedTransactionId: null,
    description: null,
    merchant: 'Mamak Ali',
    notes: null,
    transactionDate: '2026-10-10T05:00:00.000Z',
    locationLatitude: at?.latitude ?? null,
    locationLongitude: at?.longitude ?? null,
    locationName: at ? 'Mamak Ali, Jalan Telawi 3, Kuala Lumpur, Wilayah Persekutuan' : null,
    autoAdded: false,
    createdAt: '2026-10-10T05:00:00.000Z',
    ...overrides,
  };
}

const rows = [
  row('m1', MAMAK, 1250, { transactionDate: '2026-10-01T05:00:00.000Z' }),
  row('m2', { ...MAMAK, latitude: MAMAK.latitude + 20 * METRE_LAT }, 1100, {
    transactionDate: '2026-10-10T05:00:00.000Z',
  }),
  row('m3', { ...MAMAK, latitude: MAMAK.latitude + 30 * METRE_LAT }, 1320, {
    transactionDate: '2026-10-14T01:00:00.000Z',
  }),
  row('k1', KLCC, 1890, {
    merchant: 'Starbucks',
    locationName: 'Suria KLCC, Jalan Ampang, Kuala Lumpur, Wilayah Persekutuan',
    transactionDate: '2026-10-02T01:00:00.000Z',
  }),
];

describe('groupPlaces', () => {
  it('puts three rows within 30 m into one place and sums them ahead of KLCC', () => {
    const places = groupPlaces(rows, { currency: 'MYR' });
    expect(places.map((place) => [place.name, place.count, place.totalMinor])).toEqual([
      ['Mamak Ali', 3, 3670],
      ['Suria KLCC', 1, 1890],
    ]);
    expect(places[0].transactions.map((t) => t.id)).toEqual(['m3', 'm2', 'm1']);
    expect(places[0].area).toBe('Kuala Lumpur');
  });

  it('skips income, other currencies, excluded rows and rows with no place', () => {
    const places = groupPlaces(
      [
        ...rows,
        row('i1', MAMAK, 9999, { type: 'income' }),
        row('usd', MAMAK, 9999, { currency: 'USD' }),
        row('x1', MAMAK, 9999, { analysisExcluded: true }),
        row('n1', null, 9999),
      ],
      { currency: 'MYR' },
    );
    expect(places.map((place) => place.totalMinor)).toEqual([3670, 1890]);
  });

  it('keeps a place id when a range or category filter drops its first row', () => {
    const all = groupPlaces(rows, { currency: 'MYR' });
    const later = groupPlaces(rows, { currency: 'MYR', range: { from: '2026-10-05', to: '2026-10-31' } });
    expect(later.map((place) => [place.id, place.count])).toEqual([[all[0].id, 2]]);
    expect(groupPlaces(rows, { currency: 'MYR', categoryId: 'groceries' })).toEqual([]);
  });
});

describe('placeLabel', () => {
  it('reads the name and city, skipping a bare house number', () => {
    expect(placeLabel('12, Jalan SS2/24, Petaling Jaya, Selangor')).toEqual({
      name: 'Jalan SS2/24',
      area: 'Petaling Jaya',
    });
    expect(placeLabel('Bangsar')).toEqual({ name: 'Bangsar', area: null });
    expect(placeLabel(null)).toBeNull();
  });
});

describe('placeRegular', () => {
  it('names the merchant seen most, its average, and the one wallet used', () => {
    const [mamak] = groupPlaces(rows, { currency: 'MYR' });
    expect(placeRegular(mamak)).toEqual({
      merchant: 'Mamak Ali',
      visits: 3,
      averageMinor: 1223,
      walletId: 'cash',
    });
  });

  it('says nothing for a single visit', () => {
    const [, klcc] = groupPlaces(rows, { currency: 'MYR' });
    expect(placeRegular(klcc)).toBeNull();
  });
});

describe('placeRanges', () => {
  it('runs the week from Monday and names this and last month', () => {
    const now = new Date(2026, 9, 14, 14, 6);
    expect(placeRanges(now)).toEqual([
      { key: 'week', label: 'This week', words: 'this week', from: '2026-10-12', to: '2026-10-14' },
      { key: 'month', label: 'October', words: 'in October', from: '2026-10-01', to: '2026-10-14' },
      { key: 'last-month', label: 'September', words: 'in September', from: '2026-09-01', to: '2026-09-30' },
    ]);
    expect(spanLabel({ from: '2026-10-01', to: '2026-10-14' })).toBe('1–14 Oct');
    expect(spanLabel({ from: '2026-09-28', to: '2026-10-04' })).toBe('28 Sep–4 Oct');
  });
});

describe('clusterPins', () => {
  it('merges capsules that overlap on screen under the larger place', () => {
    const places = groupPlaces(rows, { currency: 'MYR' });
    const near = clusterPins(places, () => ({ x: 100, y: 100 }), () => 90);
    expect(near.map((cluster) => [cluster.lead.name, cluster.members.length, cluster.totalMinor])).toEqual([
      ['Mamak Ali', 2, 5560],
    ]);
    const far = clusterPins(places, (point) => ({ x: point === places[0] ? 0 : 300, y: 0 }), () => 90);
    expect(far.map((cluster) => cluster.members.length)).toEqual([1, 1]);
  });
});
