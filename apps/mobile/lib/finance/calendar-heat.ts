import type { MinorAmount } from '@repo/types';

/**
 * How a day's spend compares with even pace, as `V2P-InsightsCalendar` colours it:
 * at or under 1x, up to 1.5x, up to 2x, over 2x. `plain` is a past day with no even
 * pace to compare against, `future` a day still to come.
 */
export type HeatBucket = 'under' | 'x1_5' | 'x2' | 'over_x2' | 'plain' | 'future';

export type CalendarDayInput = {
  day: number;
  /** Null for a day after today. */
  spentMinor: MinorAmount | null;
  billDue: boolean;
};

export type HeatDay = CalendarDayInput & { bucket: HeatBucket };

export function heatBucket(spentMinor: MinorAmount, evenPaceMinor: MinorAmount): HeatBucket {
  const spent = Number(spentMinor);
  const pace = Number(evenPaceMinor);
  if (spent <= pace) return 'under';
  if (spent <= pace * 1.5) return 'x1_5';
  if (spent <= pace * 2) return 'x2';
  return 'over_x2';
}

/**
 * Buckets each day of a month against even pace and keeps its bill-due mark. A month
 * with nothing spent yet, or no budget to set an even pace, stays plain.
 */
export function calendarHeat(
  days: readonly CalendarDayInput[],
  evenPaceMinor: MinorAmount | null,
): HeatDay[] {
  const anySpent = days.some((day) => Number(day.spentMinor ?? 0) > 0);
  return days.map((day) => ({
    ...day,
    bucket:
      day.spentMinor === null
        ? 'future'
        : evenPaceMinor === null || evenPaceMinor <= 0 || !anySpent
          ? 'plain'
          : heatBucket(day.spentMinor, evenPaceMinor),
  }));
}
