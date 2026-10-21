import { addMinor, type CurrencyCode, type MinorAmount } from '@repo/types';

import { toLocalDateInput } from '@/lib/dates/local-date-input';
import type { FinanceTransaction } from './types';

/** Rows within this distance of a place's anchor belong to it. */
export const PLACE_RADIUS_M = 150;

export type LatLng = { latitude: number; longitude: number };

/** Local calendar days, both ends inclusive, as `YYYY-MM-DD`. */
export type DaySpan = { from: string; to: string };

export type PlaceRangeKey = 'week' | 'month' | 'last-month';

export type PlaceRange = DaySpan & {
  key: PlaceRangeKey;
  /** Segment label: "This week", "October". */
  label: string;
  /** Sentence tail: "this week", "in October". */
  words: string;
};

export type PlaceCategory = { categoryId: string | null; totalMinor: MinorAmount };

/**
 * One spot the user spends at. The anchor is the earliest located payment
 * there; anchors sit at least `PLACE_RADIUS_M` apart, so the id stays the same
 * under any range or category filter.
 */
export type Place = LatLng & {
  id: string;
  name: string;
  area: string | null;
  totalMinor: MinorAmount;
  count: number;
  days: number;
  /** Largest first. */
  categories: PlaceCategory[];
  /** Newest first. */
  transactions: FinanceTransaction[];
};

export type PlaceFilter = {
  currency: CurrencyCode;
  categoryId?: string | null;
  range?: DaySpan | null;
};

type Located = FinanceTransaction & { locationLatitude: number; locationLongitude: number };

const EARTH_M = 6_371_000;
const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export function distanceM(a: LatLng, b: LatLng): number {
  const rad = Math.PI / 180;
  const dLat = (b.latitude - a.latitude) * rad;
  const dLng = (b.longitude - a.longitude) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.latitude * rad) * Math.cos(b.latitude * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_M * Math.asin(Math.sqrt(h));
}

const M_PER_DEGREE_LAT = 111_320;

export function isAtPlace(place: LatLng, point: LatLng): boolean {
  if (Math.abs(place.latitude - point.latitude) * M_PER_DEGREE_LAT > PLACE_RADIUS_M) return false;
  return distanceM(place, point) <= PLACE_RADIUS_M;
}

function located(transaction: FinanceTransaction, currency: CurrencyCode): transaction is Located {
  return (
    transaction.type === 'expense' &&
    !transaction.analysisExcluded &&
    transaction.currency === currency &&
    transaction.locationLatitude !== null &&
    transaction.locationLongitude !== null
  );
}

function pointOf(transaction: Located): LatLng {
  return { latitude: transaction.locationLatitude, longitude: transaction.locationLongitude };
}

function anchorId(point: LatLng): string {
  return `${point.latitude.toFixed(4)},${point.longitude.toFixed(4)}`;
}

/**
 * "Jalan Telawi 3, Bangsar, Kuala Lumpur, Wilayah Persekutuan" reads as
 * "Jalan Telawi 3" in "Kuala Lumpur": the reverse-geocoded name, street, city,
 * region joined by `prefetchTransactionLocation`. A bare house number is skipped.
 */
export function placeLabel(locationName: string | null): { name: string; area: string | null } | null {
  const parts = (locationName ?? '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  const nameAt = parts.findIndex((part) => !/^\d+[A-Za-z]?$/.test(part));
  if (nameAt < 0) return null;
  const rest = parts.slice(nameAt + 1);
  return { name: parts[nameAt], area: rest.length >= 2 ? rest[rest.length - 2] : null };
}

function mostCommon<T>(values: T[]): T | undefined {
  const counts = new Map<T, number>();
  let best: T | undefined;
  for (const value of values) {
    const next = (counts.get(value) ?? 0) + 1;
    counts.set(value, next);
    if (best === undefined || next > (counts.get(best) ?? 0)) best = value;
  }
  return best;
}

function nameFor(rows: Located[]): { name: string; area: string | null } {
  const label = placeLabel(mostCommon(rows.map((row) => row.locationName).filter(Boolean)) ?? null);
  if (label) return label;
  const merchant = mostCommon(
    rows.map((row) => row.merchant ?? row.description).filter((name): name is string => !!name),
  );
  return { name: merchant ?? 'Pinned place', area: null };
}

function inSpan(transaction: FinanceTransaction, span: DaySpan | null | undefined): boolean {
  if (!span) return true;
  const day = toLocalDateInput(new Date(transaction.transactionDate));
  return day >= span.from && day <= span.to;
}

/**
 * Groups located expenses in one currency into places, largest total first.
 * Anchors come from every located row, so a filter never moves or renames a
 * place; the filter only decides which rows count toward its totals.
 */
export function groupPlaces(transactions: readonly FinanceTransaction[], filter: PlaceFilter): Place[] {
  const rows = transactions
    .filter((transaction): transaction is Located => located(transaction, filter.currency))
    .sort((a, b) => a.transactionDate.localeCompare(b.transactionDate) || a.id.localeCompare(b.id));

  const anchors: (LatLng & { id: string; members: Located[] })[] = [];
  for (const row of rows) {
    const point = pointOf(row);
    let anchor = anchors.find((candidate) => isAtPlace(candidate, point));
    if (!anchor) {
      anchor = { ...point, id: anchorId(point), members: [] };
      anchors.push(anchor);
    }
    anchor.members.push(row);
  }

  const places: Place[] = [];
  for (const anchor of anchors) {
    const counted = anchor.members.filter(
      (row) => (!filter.categoryId || row.categoryId === filter.categoryId) && inSpan(row, filter.range),
    );
    if (!counted.length) continue;
    const byCategory = new Map<string | null, MinorAmount>();
    for (const row of counted)
      byCategory.set(row.categoryId, addMinor(byCategory.get(row.categoryId) ?? 0, row.amountMinor));
    places.push({
      id: anchor.id,
      latitude: anchor.latitude,
      longitude: anchor.longitude,
      ...nameFor(anchor.members),
      totalMinor: addMinor(...counted.map((row) => row.amountMinor)),
      count: counted.length,
      days: new Set(counted.map((row) => toLocalDateInput(new Date(row.transactionDate)))).size,
      categories: [...byCategory.entries()]
        .map(([categoryId, totalMinor]) => ({ categoryId, totalMinor }))
        .sort((a, b) => b.totalMinor - a.totalMinor),
      transactions: [...counted].reverse(),
    });
  }
  return places.sort((a, b) => b.totalMinor - a.totalMinor || a.name.localeCompare(b.name));
}

/** Whole-percent share of `part` in `whole`, 0 when there is nothing. */
export function sharePercent(part: MinorAmount, whole: MinorAmount): number {
  return whole > 0 ? Math.round((part / whole) * 100) : 0;
}

export function placesTotal(places: readonly Place[]): MinorAmount {
  return addMinor(0, ...places.map((place) => place.totalMinor));
}

function startOfWeek(now: Date): Date {
  const offset = (now.getDay() + 6) % 7;
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() - offset);
}

/** The three map ranges: Monday to today, the 1st to today, and all of last month. */
export function placeRanges(now: Date): PlaceRange[] {
  const today = toLocalDateInput(now);
  const month = MONTHS[now.getMonth()];
  const lastStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastEnd = new Date(now.getFullYear(), now.getMonth(), 0);
  const last = MONTHS[lastStart.getMonth()];
  return [
    { key: 'week', label: 'This week', words: 'this week', from: toLocalDateInput(startOfWeek(now)), to: today },
    {
      key: 'month',
      label: month,
      words: `in ${month}`,
      from: toLocalDateInput(new Date(now.getFullYear(), now.getMonth(), 1)),
      to: today,
    },
    {
      key: 'last-month',
      label: last,
      words: `in ${last}`,
      from: toLocalDateInput(lastStart),
      to: toLocalDateInput(lastEnd),
    },
  ];
}

export function placeRange(key: string | undefined, now: Date): PlaceRange {
  const ranges = placeRanges(now);
  return ranges.find((range) => range.key === key) ?? ranges[1];
}

/** "1–14 Oct", or "28 Sep–4 Oct" across a month end. */
export function spanLabel({ from, to }: DaySpan): string {
  const [fy, fm, fd] = from.split('-').map(Number);
  const [ty, tm, td] = to.split('-').map(Number);
  const short = (m: number) => MONTHS[m - 1].slice(0, 3);
  if (from === to) return `${td} ${short(tm)}`;
  if (fy === ty && fm === tm) return `${fd}–${td} ${short(tm)}`;
  return `${fd} ${short(fm)}–${td} ${short(tm)}`;
}

export type PlaceRegular = {
  merchant: string;
  visits: number;
  averageMinor: MinorAmount;
  /** Set when every visit used the same wallet. */
  walletId: string | null;
};

/** The merchant paid most often at a place, once it has at least two visits. */
export function placeRegular(place: Place): PlaceRegular | null {
  const byMerchant = new Map<string, FinanceTransaction[]>();
  for (const transaction of place.transactions) {
    if (!transaction.merchant) continue;
    byMerchant.set(transaction.merchant, [...(byMerchant.get(transaction.merchant) ?? []), transaction]);
  }
  const [merchant, visits] =
    [...byMerchant.entries()].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))[0] ?? [];
  if (!merchant || !visits || visits.length < 2) return null;
  const wallets = new Set(visits.map((visit) => visit.walletId));
  return {
    merchant,
    visits: visits.length,
    averageMinor: Math.round(addMinor(...visits.map((visit) => visit.amountMinor)) / visits.length) as MinorAmount,
    walletId: wallets.size === 1 ? visits[0].walletId : null,
  };
}

export type Region = LatLng & { latitudeDelta: number; longitudeDelta: number };

/** A region that frames every point with some margin, or null with none. */
export function regionFor(points: readonly LatLng[], minDelta = 0.02): Region | null {
  if (!points.length) return null;
  const lats = points.map((point) => point.latitude);
  const lngs = points.map((point) => point.longitude);
  const [minLat, maxLat, minLng, maxLng] = [Math.min(...lats), Math.max(...lats), Math.min(...lngs), Math.max(...lngs)];
  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: Math.max((maxLat - minLat) * 1.4, minDelta),
    longitudeDelta: Math.max((maxLng - minLng) * 1.4, minDelta),
  };
}

export type PinCluster = {
  /** The largest member, whose spot the pin sits on. */
  lead: Place;
  members: Place[];
  totalMinor: MinorAmount;
};

const PIN_GAP = 4;
const PIN_ROW = 36;

/**
 * Merges pins whose capsules would overlap on screen, largest place first, as
 * `XM-Places` draws "RM328 2". `toScreen` maps a coordinate to view pixels;
 * `widthOf` estimates a capsule's width from its label and member count.
 */
export function clusterPins(
  places: readonly Place[],
  toScreen: (point: LatLng) => { x: number; y: number },
  widthOf: (totalMinor: MinorAmount, members: number) => number,
): PinCluster[] {
  const seeds: (PinCluster & { x: number; y: number; width: number })[] = [];
  for (const place of places) {
    const { x, y } = toScreen(place);
    const width = widthOf(place.totalMinor, 1);
    const hit = seeds.find(
      (seed) => Math.abs(seed.x - x) < (seed.width + width) / 2 + PIN_GAP && Math.abs(seed.y - y) < PIN_ROW,
    );
    if (hit) {
      hit.members.push(place);
      hit.totalMinor = addMinor(hit.totalMinor, place.totalMinor);
      hit.width = widthOf(hit.totalMinor, hit.members.length);
    } else {
      seeds.push({ lead: place, members: [place], totalMinor: place.totalMinor, x, y, width });
    }
  }
  return seeds.map(({ lead, members, totalMinor }) => ({ lead, members, totalMinor }));
}

/** Linear screen projection of a map region; close enough at city zoom. */
export function projector(region: Region, size: { width: number; height: number }) {
  const west = region.longitude - region.longitudeDelta / 2;
  const north = region.latitude + region.latitudeDelta / 2;
  return (point: LatLng) => ({
    x: ((point.longitude - west) / region.longitudeDelta) * size.width,
    y: ((north - point.latitude) / region.latitudeDelta) * size.height,
  });
}
