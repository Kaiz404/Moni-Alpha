import { addDays, daysBetween, firstDayOf, monthOf, type DayKey } from './calendar';

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

function yearBefore(day: DayKey): DayKey {
  const year = Number(day.slice(0, 4)) - 1;
  const shifted = `${year}${day.slice(4, 8)}01`;
  return addDays(shifted, Number(day.slice(8, 10)) - 1);
}

/** The range's first day when it ends on `today`, or null for `all`, which starts wherever the data does. */
export function chartRangeStart(today: DayKey, range: ChartRange): DayKey | null {
  switch (range) {
    case '1m':
      return firstDayOf(monthOf(today));
    case '7d':
      return addDays(today, -6);
    case '30d':
      return addDays(today, -29);
    case '90d':
      return addDays(today, -89);
    case '1y':
      return yearBefore(today);
    case 'all':
      return null;
  }
}

/**
 * The days a range shows `back` steps before the one ending `today`. Each older window ends the day
 * before the newer one starts, so 1M steps by calendar month. `all` starts wherever the data does and
 * has no older window: `back` is ignored.
 */
export function chartWindow(
  today: DayKey,
  range: ChartRange,
  back: number,
): { start: DayKey | null; end: DayKey } {
  let end = today;
  for (let step = 0; step < back; step++) {
    const start = chartRangeStart(end, range);
    if (start === null) break;
    end = addDays(start, -1);
  }
  return { start: chartRangeStart(end, range), end };
}

/** Where the range ending `today` starts in a day index that begins on `firstDay`, or null for `all`. */
export function rangeStartIndex(firstDay: DayKey, today: DayKey, range: ChartRange): number | null {
  const start = chartRangeStart(today, range);
  return start === null ? null : daysBetween(firstDay, start);
}
