import { describe, expect, it } from 'vitest';
import type { MinorAmount } from '@repo/types';

import { createCalendar } from '../../calendar';
import { clusterPins, fitFrame, googleZoom, zoomMoved } from '../place-map';
import { groupPlaces } from '../places';
import type { FinanceTransaction } from '../types';

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

describe('clusterPins', () => {
  it('merges capsules that overlap on screen under the larger place', () => {
    const places = groupPlaces(rows, { currency: 'MYR' }, KL);
    const near = clusterPins(places, () => ({ x: 100, y: 100 }), () => 90);
    expect(near.map((cluster) => [cluster.lead.name, cluster.members.length, cluster.totalMinor])).toEqual([
      ['Mamak Ali', 2, 5560],
    ]);
    const far = clusterPins(places, (point) => ({ x: point === places[0] ? 0 : 300, y: 0 }), () => 90);
    expect(far.map((cluster) => cluster.members.length)).toEqual([1, 1]);
  });

  it('merges capsules stacked closer than a row, whose height the caller can set', () => {
    const places = groupPlaces(rows, { currency: 'MYR' }, KL);
    const stacked = (point: { latitude: number }) => ({ x: 0, y: point === places[0] ? 0 : 40 });
    expect(clusterPins(places, stacked, () => 90).map((cluster) => cluster.members.length)).toEqual([1, 1]);
    expect(clusterPins(places, stacked, () => 90, 44).map((cluster) => cluster.members.length)).toEqual([2]);
  });

  it('leads with the largest place whatever order the list is in', () => {
    const places = groupPlaces(rows, { currency: 'MYR' }, KL);
    const clusters = clusterPins([...places].reverse(), () => ({ x: 0, y: 0 }), () => 90);
    expect(clusters.map((cluster) => cluster.lead.name)).toEqual(['Mamak Ali']);
  });
});

describe('fitFrame', () => {
  const box = { width: 220, height: 120 };
  const insets = { top: 10, right: 10, bottom: 10, left: 10 };

  it('frames the points at one scale, north up, centred in the free area', () => {
    const { project: at } = fitFrame(
      [
        { latitude: 0, longitude: 0 },
        { latitude: 0.01, longitude: 0.01 },
      ],
      box,
      insets,
    );
    const south = at({ latitude: 0, longitude: 0 });
    const north = at({ latitude: 0.01, longitude: 0.01 });
    expect([Math.round(south.x), Math.round(south.y)]).toEqual([60, 110]);
    expect([Math.round(north.x), Math.round(north.y)]).toEqual([160, 10]);
  });

  it('puts one place in the middle', () => {
    expect(fitFrame([MAMAK], box, insets).project(MAMAK)).toEqual({ x: 110, y: 60 });
  });

  it('frames Kuala Lumpur in the middle of the free area when there is nothing', () => {
    expect(fitFrame([], box, { top: 40, right: 10, bottom: 0, left: 10 }).project({ latitude: 3.139, longitude: 101.6869 })).toEqual({ x: 110, y: 80 });
  });

  it('reads a screen point back to the place under it', () => {
    const frame = fitFrame([MAMAK, KLCC], box, insets);
    const back = frame.unproject(frame.project(KLCC));
    expect([back.latitude.toFixed(6), back.longitude.toFixed(6)]).toEqual([KLCC.latitude.toFixed(6), KLCC.longitude.toFixed(6)]);
  });
});

describe('googleZoom', () => {
  it('is zoom 0 when the world’s 360 degrees fill one 256 px tile, and one up per doubling', () => {
    expect([googleZoom(256 / 360), googleZoom(512 / 360), googleZoom(256 * 4096 / 360)]).toEqual([0, 1, 12]);
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
