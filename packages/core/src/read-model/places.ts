import { addMinor, type CurrencyCode, type MinorAmount } from '@repo/types';

import { addDays, type Calendar, dayOfMonth, daysBetween, type DayKey, monthOf, weekday } from '../calendar';
import { monthShort, shortDate } from '../glossary';
import { countsAsSpending } from '../ledger';
import type { FinanceTransaction } from './types';

/** Rows within this distance of a place's anchor belong to it. */
export const PLACE_RADIUS_M = 150;

export type LatLng = { latitude: number; longitude: number };

/** Local calendar days, both ends inclusive, as `YYYY-MM-DD`. */
export type DaySpan = { from: string; to: string };

export type PlaceRangeKey = '7d' | '30d' | 'all';

export type PlaceRange = {
  key: PlaceRangeKey;
  /** Segment label: "Last 7 days". */
  label: string;
  /** Sentence tail: "in the last 7 days", "so far". */
  words: string;
  /** Null for All time. */
  span: DaySpan | null;
};

export type PlaceCategory = { categoryId: string | null; totalMinor: MinorAmount };

/**
 * One spot the user spends at. The anchor is the earliest located payment
 * there; anchors without a Google place ID sit at least `PLACE_RADIUS_M` apart,
 * so the id stays the same under any range or category filter.
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
  walletId?: string | null;
  range?: DaySpan | null;
};

function counts(transaction: FinanceTransaction, filter: PlaceFilter, calendar: Calendar): boolean {
  return (
    (!filter.categoryId || transaction.categoryId === filter.categoryId) &&
    (!filter.walletId || transaction.walletId === filter.walletId) &&
    inSpan(transaction, filter.range, calendar)
  );
}

type Located = FinanceTransaction & { locationLatitude: number; locationLongitude: number };

const EARTH_M = 6_371_000;
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
    countsAsSpending(transaction) &&
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
  return { name: parts[nameAt]!, area: rest.length >= 2 ? rest[rest.length - 2]! : null };
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

function inSpan(
  transaction: FinanceTransaction,
  span: DaySpan | null | undefined,
  calendar: Calendar,
): boolean {
  if (!span) return true;
  const day = calendar.dayKey(transaction.transactionDate);
  return day >= span.from && day <= span.to;
}

/**
 * Groups located expenses in one currency into places, largest total first.
 * Anchors come from every located row, so a filter never moves or renames a
 * place; the filter only decides which rows count toward its totals.
 */
export function groupPlaces(
  transactions: readonly FinanceTransaction[],
  filter: PlaceFilter,
  calendar: Calendar,
): Place[] {
  const rows = transactions
    .filter((transaction): transaction is Located => located(transaction, filter.currency))
    .sort((a, b) => a.transactionDate.localeCompare(b.transactionDate) || a.id.localeCompare(b.id));

  // A place ID names one shop, so rows that carry one gather by it; two shops in one mall stay
  // two places. Rows without one fall back to distance.
  const anchors: (LatLng & { id: string; placeId: string | null; members: Located[] })[] = [];
  for (const row of rows) {
    const point = pointOf(row);
    let anchor = row.placeId
      ? (anchors.find((candidate) => candidate.placeId === row.placeId) ??
        anchors.find((candidate) => !candidate.placeId && isAtPlace(candidate, point)))
      : anchors.find((candidate) => isAtPlace(candidate, point));
    if (!anchor) {
      anchor = { ...point, id: row.placeId ?? anchorId(point), placeId: row.placeId, members: [] };
      anchors.push(anchor);
    }
    anchor.placeId ??= row.placeId;
    anchor.members.push(row);
  }

  const places: Place[] = [];
  for (const anchor of anchors) {
    const counted = anchor.members.filter((row) => counts(row, filter, calendar));
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
      days: new Set(counted.map((row) => calendar.dayKey(row.transactionDate))).size,
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

/** The map ranges: rolling 7 and 30 days ending today, and every day. */
export function placeRanges(now: Date, calendar: Calendar): PlaceRange[] {
  const today = calendar.dayKey(now);
  const back = (days: number): DaySpan => ({
    from: addDays(today, -(days - 1)),
    to: today,
  });
  return [
    { key: '7d', label: 'Last 7 days', words: 'in the last 7 days', span: back(7) },
    { key: '30d', label: 'Last 30 days', words: 'in the last 30 days', span: back(30) },
    { key: 'all', label: 'All time', words: 'so far', span: null },
  ];
}

export function placeRange(key: string | undefined, now: Date, calendar: Calendar): PlaceRange {
  const ranges = placeRanges(now, calendar);
  return ranges.find((range) => range.key === key) ?? ranges[1]!;
}

/** "1–14 Oct", or "28 Sep–4 Oct" across a month end. */
export function spanLabel({ from, to }: DaySpan): string {
  if (from === to) return shortDate(to);
  if (monthOf(from) === monthOf(to)) return `${dayOfMonth(from)}–${shortDate(to)}`;
  return `${shortDate(from)}–${shortDate(to)}`;
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
    walletId: wallets.size === 1 ? visits[0]!.walletId : null,
  };
}

/**
 * Expenses in one currency that carry no location, newest first: what "Without a place" lists and
 * Add a place can pin. The filter counts as it does for `groupPlaces`.
 */
export function unplacedExpenses(
  transactions: readonly FinanceTransaction[],
  filter: PlaceFilter,
  calendar: Calendar,
): FinanceTransaction[] {
  return transactions
    .filter(
      (transaction) =>
        countsAsSpending(transaction) &&
        transaction.currency === filter.currency &&
        (transaction.locationLatitude === null || transaction.locationLongitude === null) &&
        counts(transaction, filter, calendar),
    )
    .sort((a, b) => b.transactionDate.localeCompare(a.transactionDate) || b.id.localeCompare(a.id));
}

/** The days a range covers; All time starts on the earliest payment at any of `places`. */
export function placesSpan(range: PlaceRange, places: readonly Place[], today: DayKey, calendar: Calendar): DaySpan {
  if (range.span) return range.span;
  const days = places.flatMap((place) => place.transactions.map((transaction) => calendar.dayKey(transaction.transactionDate)));
  return { from: days.reduce((first, day) => (day < first ? day : first), today), to: today };
}

export type PlaceDay = {
  day: DayKey;
  date: number;
  /** "Oct" on the first column and on each month's 1st, else null. */
  month: string | null;
  weekend: boolean;
};

/** Each day of a span: the columns of Day by day and the bars of a place's visits. */
export function placeDays(span: DaySpan): PlaceDay[] {
  const count = daysBetween(span.from, span.to) + 1;
  return Array.from({ length: Math.max(count, 0) }, (_, index) => {
    const day = addDays(span.from, index);
    const date = dayOfMonth(day);
    return {
      day,
      date,
      month: index === 0 || date === 1 ? monthShort(monthOf(day)) : null,
      weekend: weekday(day) === 0 || weekday(day) === 6,
    };
  });
}

export type PlaceDayTotal = {
  totalMinor: MinorAmount;
  /** The day's largest payment's category, which colours its dot or bar. */
  categoryId: string | null;
};

/** What a place took on each day it was paid, by day key. */
export function placeByDay(place: Place, calendar: Calendar): Record<DayKey, PlaceDayTotal> {
  const days: Record<DayKey, PlaceDayTotal & { largest: MinorAmount }> = {};
  for (const transaction of [...place.transactions].reverse()) {
    const day = calendar.dayKey(transaction.transactionDate);
    const current = days[day];
    if (!current) {
      days[day] = { totalMinor: transaction.amountMinor, categoryId: transaction.categoryId, largest: transaction.amountMinor };
    } else {
      current.totalMinor = addMinor(current.totalMinor, transaction.amountMinor);
      if (transaction.amountMinor > current.largest) {
        current.largest = transaction.amountMinor;
        current.categoryId = transaction.categoryId;
      }
    }
  }
  return Object.fromEntries(Object.entries(days).map(([day, { totalMinor, categoryId }]) => [day, { totalMinor, categoryId }]));
}

/** Where a payment pinned to a place goes: its anchor, its most common address, its Google place ID. */
export function placeLocation(place: Place): LatLng & { locationName: string; placeId: string | null } {
  return {
    latitude: place.latitude,
    longitude: place.longitude,
    locationName: mostCommon(place.transactions.map((row) => row.locationName).filter((name): name is string => !!name)) ?? place.name,
    placeId: place.transactions.find((row) => row.placeId)?.placeId ?? null,
  };
}
