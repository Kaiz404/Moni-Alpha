import { toLocalDateInput } from '@/lib/dates/local-date-input';

/** `1m` is the calendar month so far, which is what sets it apart from `30d`. */
export type ChartRange = '1m' | '7d' | '30d' | '90d' | '1y' | 'all';

export const CHART_RANGES: readonly { value: ChartRange; label: string }[] = [
  { value: '1m', label: '1M' },
  { value: '7d', label: '7D' },
  { value: '30d', label: '30D' },
  { value: '90d', label: '90D' },
  { value: '1y', label: '1Y' },
  { value: 'all', label: 'All' },
];

/** The range's first local day, or null for `all`, which starts wherever the data does. */
export function chartRangeStart(now: Date, range: ChartRange): string | null {
  const [year, month, day] = [now.getFullYear(), now.getMonth(), now.getDate()];
  switch (range) {
    case '1m':
      return toLocalDateInput(new Date(year, month, 1));
    case '7d':
      return toLocalDateInput(new Date(year, month, day - 6));
    case '30d':
      return toLocalDateInput(new Date(year, month, day - 29));
    case '90d':
      return toLocalDateInput(new Date(year, month, day - 89));
    case '1y':
      return toLocalDateInput(new Date(year - 1, month, day));
    case 'all':
      return null;
  }
}

/** Day `index` counted on the calendar from `firstDay`, so a daylight saving change cannot skip or repeat a day. */
export function dateAt(firstDay: string, index: number): Date {
  const [year, month, day] = firstDay.split('-').map(Number);
  return new Date(year!, month! - 1, day! + index);
}

/** Days since 1970 of a `YYYY-MM-DD` calendar day, counted in UTC so no day is 23 or 25 hours. */
export function dayNumber(day: string): number {
  return Date.UTC(Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1, Number(day.slice(8, 10))) / 86_400_000;
}

/** Whole calendar days from `firstDay` to `day`, both `YYYY-MM-DD`; negative before it. */
export function daysBetween(firstDay: string, day: string): number {
  return dayNumber(day) - dayNumber(firstDay);
}

/** Where the range starts in a day index that begins on `firstDay`, or null for `all`. */
export function rangeStartIndex(firstDay: string, now: Date, range: ChartRange): number | null {
  const start = chartRangeStart(now, range);
  return start === null ? null : daysBetween(firstDay, start);
}
