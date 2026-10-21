import { formatDay } from '@/lib/dates/day-label';

/** Glossary time: lowercase with a space, `12:41 pm`. */
export function clockTime(date: Date): string {
  const hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours % 12 || 12}:${minutes} ${hours < 12 ? 'am' : 'pm'}`;
}

/** A capture's date field: `Today, 2:05 pm`, `Tue 13 Oct, 9:12 am`. */
export function dayAndTime(iso: string, now: Date = new Date()): string {
  const date = new Date(iso);
  return `${formatDay(date, now)}, ${clockTime(date)}`;
}
