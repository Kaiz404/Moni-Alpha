import type { MinorAmount } from '@repo/types';

import { groupPlaces, type FinanceTransaction } from '@repo/core';
import { deviceCalendar } from '@/lib/dates/device-calendar';
import { clusterPins, zoomMoved } from '../map-view';

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

describe('clusterPins', () => {
  it('merges capsules that overlap on screen under the larger place', () => {
    const places = groupPlaces(rows, { currency: 'MYR' }, deviceCalendar);
    const near = clusterPins(places, () => ({ x: 100, y: 100 }), () => 90);
    expect(near.map((cluster) => [cluster.lead.name, cluster.members.length, cluster.totalMinor])).toEqual([
      ['Mamak Ali', 2, 5560],
    ]);
    const far = clusterPins(places, (point) => ({ x: point === places[0] ? 0 : 300, y: 0 }), () => 90);
    expect(far.map((cluster) => cluster.members.length)).toEqual([1, 1]);
  });
});

describe('zoomMoved', () => {
  const at = (latitudeDelta: number, latitude = 3) => ({
    latitude,
    longitude: 101,
    latitudeDelta,
    longitudeDelta: latitudeDelta,
  });

  it.each([
    ['the first region', null, at(0.1), true],
    ['a pan at the same zoom', at(0.1), at(0.1, 3.5), false],
    ['a tiny zoom', at(0.1), at(0.105), false],
    ['a pinch in', at(0.1), at(0.08), true],
    ['a pinch out', at(0.1), at(0.12), true],
  ])('%s', (_name, previous, next, expected) => {
    expect(zoomMoved(previous, next)).toBe(expected);
  });
});
