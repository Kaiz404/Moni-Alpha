import { describe, expect, it } from 'vitest';
import type { MinorAmount } from '@repo/types';

import type { FinanceTransaction } from '../types';
import { createCalendar } from '../../calendar';
import {
  groupPlaces,
  placeByDay,
  placeDays,
  placeLabel,
  placeLocation,
  placeRange,
  placeRanges,
  placeRegular,
  placesSpan,
  spanLabel,
  unplacedExpenses,
} from '../places';

const KL = createCalendar('Asia/Kuala_Lumpur');
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
    receiptImageUrl: null,
    metadata: {},
    updatedAt: '2026-10-01T00:00:00.000Z',
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
    placeId: null,
    placeCoordsAt: null,
    autoAdded: false,
    balanceCorrection: false,
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
    const places = groupPlaces(rows, { currency: 'MYR' }, KL);
    expect(places.map((place) => [place.name, place.count, place.totalMinor])).toEqual([
      ['Mamak Ali', 3, 3670],
      ['Suria KLCC', 1, 1890],
    ]);
    expect(places[0]!.transactions.map((t) => t.id)).toEqual(['m3', 'm2', 'm1']);
    expect(places[0]!.area).toBe('Kuala Lumpur');
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
      KL,
    );
    expect(places.map((place) => place.totalMinor)).toEqual([3670, 1890]);
  });

  it('keeps a place id when a range or category filter drops its first row', () => {
    const all = groupPlaces(rows, { currency: 'MYR' }, KL);
    const later = groupPlaces(
      rows,
      { currency: 'MYR', range: { from: '2026-10-05', to: '2026-10-31' } },
      KL,
    );
    expect(later.map((place) => [place.id, place.count])).toEqual([[all[0]!.id, 2]]);
    expect(groupPlaces(rows, { currency: 'MYR', categoryId: 'groceries' }, KL)).toEqual([]);
  });

  it('gathers picks of one Google place, and keeps two shops in one mall apart', () => {
    const mall = { latitude: 3.118, longitude: 101.677 };
    const near = (metres: number) => ({ ...mall, latitude: mall.latitude + metres * METRE_LAT });
    const places = groupPlaces(
      [
        row('a1', mall, 1000, { placeId: 'shop-a', merchant: 'Shop A', locationName: 'Shop A' }),
        row('b1', near(15), 2000, { placeId: 'shop-b', merchant: 'Shop B', locationName: 'Shop B' }),
        row('a2', near(140), 500, {
          placeId: 'shop-a',
          merchant: 'Shop A',
          locationName: 'Shop A',
          transactionDate: '2026-10-11T05:00:00.000Z',
        }),
        row('p1', near(5), 300, {
          merchant: 'Shop A',
          locationName: 'Shop A',
          transactionDate: '2026-10-12T05:00:00.000Z',
        }),
      ],
      { currency: 'MYR' },
      KL,
    );
    expect(
      places.map((place) => [place.id, place.transactions.map((t) => t.id)]),
    ).toEqual([
      ['shop-b', ['b1']],
      ['shop-a', ['p1', 'a2', 'a1']],
    ]);
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
    const [mamak] = groupPlaces(rows, { currency: 'MYR' }, KL);
    expect(placeRegular(mamak!)).toEqual({
      merchant: 'Mamak Ali',
      visits: 3,
      averageMinor: 1223,
      walletId: 'cash',
    });
  });

  it('says nothing for a single visit', () => {
    const [, klcc] = groupPlaces(rows, { currency: 'MYR' }, KL);
    expect(placeRegular(klcc!)).toBeNull();
  });
});

describe('placeRanges', () => {
  it('offers rolling 7 and 30 days ending today, and all time', () => {
    const now = new Date('2026-10-14T14:06:00+08:00');
    expect(placeRanges(now, KL)).toEqual([
      { key: '7d', label: 'Last 7 days', words: 'in the last 7 days', span: { from: '2026-10-08', to: '2026-10-14' } },
      { key: '30d', label: 'Last 30 days', words: 'in the last 30 days', span: { from: '2026-09-15', to: '2026-10-14' } },
      { key: 'all', label: 'All time', words: 'so far', span: null },
    ]);
    expect(placeRange(undefined, now, KL).key).toBe('30d');
    expect(placeRange('month', now, KL).key).toBe('30d');
    expect(spanLabel({ from: '2026-10-01', to: '2026-10-14' })).toBe('1–14 Oct');
    expect(spanLabel({ from: '2026-09-28', to: '2026-10-04' })).toBe('28 Sep–4 Oct');
  });
});

describe('the wallet filter', () => {
  it('counts only that wallet, and keeps every place where it was', () => {
    const mixed = [...rows, row('m4', MAMAK, 500, { walletId: 'maybank', transactionDate: '2026-10-12T05:00:00.000Z' })];
    const all = groupPlaces(mixed, { currency: 'MYR' }, KL);
    const maybank = groupPlaces(mixed, { currency: 'MYR', walletId: 'maybank' }, KL);
    expect(maybank.map((place) => [place.id, place.name, place.totalMinor, place.count])).toEqual([[all[0]!.id, 'Mamak Ali', 500, 1]]);
  });
});

describe('unplacedExpenses', () => {
  const loose = [
    ...rows,
    row('s1', null, 1940, { merchant: 'Shopee', transactionDate: '2026-10-11T03:00:00.000Z' }),
    row('n1', null, 5490, { merchant: 'Netflix', categoryId: 'subscriptions', transactionDate: '2026-09-15T03:00:00.000Z' }),
    row('i1', null, 9000, { type: 'income', transactionDate: '2026-10-12T03:00:00.000Z' }),
    row('u1', null, 1000, { currency: 'USD', transactionDate: '2026-10-12T03:00:00.000Z' }),
  ];

  it('lists expenses in the currency with no location, newest first', () => {
    expect(unplacedExpenses(loose, { currency: 'MYR' }, KL).map((transaction) => transaction.id)).toEqual(['s1', 'n1']);
  });

  it('takes the range and the category like the map', () => {
    expect(unplacedExpenses(loose, { currency: 'MYR', range: { from: '2026-10-01', to: '2026-10-14' } }, KL).map((t) => t.id)).toEqual(['s1']);
    expect(unplacedExpenses(loose, { currency: 'MYR', categoryId: 'subscriptions' }, KL).map((t) => t.id)).toEqual(['n1']);
  });
});

describe('Day by day', () => {
  it('lists each day of a span with weekends and month starts', () => {
    expect(placeDays({ from: '2026-09-29', to: '2026-10-04' })).toEqual([
      { day: '2026-09-29', date: 29, month: 'Sep', weekend: false },
      { day: '2026-09-30', date: 30, month: null, weekend: false },
      { day: '2026-10-01', date: 1, month: 'Oct', weekend: false },
      { day: '2026-10-02', date: 2, month: null, weekend: false },
      { day: '2026-10-03', date: 3, month: null, weekend: true },
      { day: '2026-10-04', date: 4, month: null, weekend: true },
    ]);
  });

  it('starts All time on the earliest payment at a place', () => {
    const places = groupPlaces(rows, { currency: 'MYR' }, KL);
    const now = new Date('2026-10-14T15:00:00+08:00');
    expect(placesSpan(placeRange('all', now, KL), places, '2026-10-14', KL)).toEqual({ from: '2026-10-01', to: '2026-10-14' });
    expect(placesSpan(placeRange('7d', now, KL), places, '2026-10-14', KL)).toEqual({ from: '2026-10-08', to: '2026-10-14' });
    expect(placesSpan(placeRange('all', now, KL), [], '2026-10-14', KL)).toEqual({ from: '2026-10-14', to: '2026-10-14' });
  });

  it('adds up a place by local day, coloured by the day’s largest payment', () => {
    const day = [
      row('a', MAMAK, 1000, { transactionDate: '2026-10-10T02:00:00.000Z' }),
      row('b', MAMAK, 2500, { categoryId: 'groceries', transactionDate: '2026-10-10T09:00:00.000Z' }),
      row('c', MAMAK, 700, { transactionDate: '2026-10-10T17:00:00.000Z' }),
    ];
    const [place] = groupPlaces(day, { currency: 'MYR' }, KL);
    expect(placeByDay(place!, KL)).toEqual({
      '2026-10-10': { totalMinor: 3500, categoryId: 'groceries' },
      '2026-10-11': { totalMinor: 700, categoryId: 'food' },
    });
    const [utc] = groupPlaces(day, { currency: 'MYR' }, createCalendar('UTC'));
    expect(placeByDay(utc!, createCalendar('UTC'))).toEqual({
      '2026-10-10': { totalMinor: 4200, categoryId: 'groceries' },
    });
  });
});

describe('placeLocation', () => {
  it('is the anchor, the most common address and any place ID', () => {
    const [mamak] = groupPlaces([...rows.slice(0, 2), row('p', MAMAK, 900, { placeId: 'gp-1' })], { currency: 'MYR' }, KL);
    expect(placeLocation(mamak!)).toEqual({
      latitude: MAMAK.latitude,
      longitude: MAMAK.longitude,
      locationName: 'Mamak Ali, Jalan Telawi 3, Kuala Lumpur, Wilayah Persekutuan',
      placeId: 'gp-1',
    });
  });
});
