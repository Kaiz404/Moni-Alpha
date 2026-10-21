import { parseLocalDateInput } from '@/lib/dates/local-date-input';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function relativeDay(date: Date, now: Date): 'Today' | 'Yesterday' | null {
  const days = Math.round((startOfDay(now) - startOfDay(date)) / 86_400_000);
  return days === 0 ? 'Today' : days === 1 ? 'Yesterday' : null;
}

function formatDate(value: string | Date, now: Date = new Date()): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  const label = `${WEEKDAYS[date.getDay()]} ${date.getDate()} ${MONTHS[date.getMonth()]}`;
  return date.getFullYear() === now.getFullYear() ? label : `${label} ${date.getFullYear()}`;
}

export function formatDay(value: string | Date, now: Date = new Date()): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  return relativeDay(date, now) ?? formatDate(date, now);
}

export function formatDayHeading(value: string | Date, now: Date = new Date()): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  const relative = relativeDay(date, now);
  return relative ? `${relative} · ${formatDate(date, now)}` : formatDate(date, now);
}

/** Glossary day label for a local `YYYY-MM-DD`; anything unparseable comes back as is. */
export function dayLabel(value: string, now: Date = new Date()): string {
  const date = parseLocalDateInput(value);
  return date ? formatDay(date, now) : value;
}
