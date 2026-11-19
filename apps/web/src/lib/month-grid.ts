import { addDays, daysInMonth, firstDayOf, weekday, type DayKey, type MonthKey } from '@repo/core';

export const WEEKDAY_INITIALS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'] as const;

/** A month as weeks from Monday to Sunday; days outside the month are null. */
export function monthWeeks(month: MonthKey): (DayKey | null)[][] {
  const first = firstDayOf(month);
  const lead = (weekday(first) + 6) % 7;
  const cells: (DayKey | null)[] = [
    ...Array<null>(lead).fill(null),
    ...Array.from({ length: daysInMonth(month) }, (_, at) => addDays(first, at)),
  ];
  while (cells.length % 7) cells.push(null);
  return Array.from({ length: cells.length / 7 }, (_, week) => cells.slice(week * 7, week * 7 + 7));
}
