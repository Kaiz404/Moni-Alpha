/**
 * Civil days and months, and the one place an instant becomes one. A day key and a month key name a
 * day on the wall calendar, so the arithmetic on them needs no zone; `createCalendar` reads an
 * instant in one explicit IANA zone.
 */

/** A civil day, `YYYY-MM-DD`. */
export type DayKey = string;
/** A civil month, `YYYY-MM`. */
export type MonthKey = string;
/** A moment: a `Date`, an ISO string, or epoch milliseconds. */
export type Instant = Date | string | number;

const DAY_MS = 86_400_000;
const DAY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

const pad = (value: number) => String(value).padStart(2, '0');

function parts(day: DayKey): [year: number, month: number, date: number] {
  return [Number(day.slice(0, 4)), Number(day.slice(5, 7)), Number(day.slice(8, 10))];
}

/** The day key of a year, a month (1 to 12) and a date, unchecked: `parseDayKey` it when unsure. */
export function dayKeyOf(year: number, month: number, date: number): DayKey {
  return `${year}-${pad(month)}-${pad(date)}`;
}

/** Days since 1970-01-01 of a civil day; counted in UTC so no day is 23 or 25 hours. */
export function dayNumber(day: DayKey): number {
  const [year, month, date] = parts(day);
  return Date.UTC(year, month - 1, date) / DAY_MS;
}

/** The civil day `number` days after 1970-01-01; '' for NaN, the day number of an invalid instant. */
export function dayFromNumber(number: number): DayKey {
  return Number.isFinite(number) ? new Date(number * DAY_MS).toISOString().slice(0, 10) : '';
}

/** A `YYYY-MM-DD` that names a real day, or null. */
export function parseDayKey(value: string): DayKey | null {
  const match = DAY_PATTERN.exec(value.trim());
  if (!match) return null;
  const day = `${match[1]}-${match[2]}-${match[3]}`;
  return dayFromNumber(dayNumber(day)) === day ? day : null;
}

/** For a month that arrived as a route param. */
export function isMonthKey(value: string | undefined): value is MonthKey {
  return value !== undefined && MONTH_PATTERN.test(value);
}

export function addDays(day: DayKey, days: number): DayKey {
  return dayFromNumber(dayNumber(day) + days);
}

/** Whole civil days from `from` to `to`; negative when `to` comes first. */
export function daysBetween(from: DayKey, to: DayKey): number {
  return dayNumber(to) - dayNumber(from);
}

/** 0 for Sunday through 6 for Saturday. */
export function weekday(day: DayKey): number {
  return (((dayNumber(day) + 4) % 7) + 7) % 7;
}

export function dayOfMonth(day: DayKey): number {
  return Number(day.slice(8, 10));
}

export function monthOf(day: DayKey): MonthKey {
  return day.slice(0, 7);
}

export function firstDayOf(month: MonthKey): DayKey {
  return `${month}-01`;
}

export function lastDayOf(month: MonthKey): DayKey {
  return `${month}-${pad(daysInMonth(month))}`;
}

export function daysInMonth(month: MonthKey): number {
  const [year, number] = month.split('-').map(Number) as [number, number];
  return new Date(Date.UTC(year, number, 0)).getUTCDate();
}

export function shiftMonth(month: MonthKey, by: number): MonthKey {
  const [year, number] = month.split('-').map(Number) as [number, number];
  const shifted = new Date(Date.UTC(year, number - 1 + by, 1));
  return `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}`;
}

/** Whole months from `from` to `to`; negative when `to` comes first. */
export function monthsBetween(from: MonthKey, to: MonthKey): number {
  const [fromYear, fromMonth] = from.split('-').map(Number) as [number, number];
  const [toYear, toMonth] = to.split('-').map(Number) as [number, number];
  return (toYear - fromYear) * 12 + toMonth - fromMonth;
}

/** Day `date` of the month `months` after the one holding `day`, clamped to that month's length. */
export function addMonths(day: DayKey, months: number, date: number): DayKey {
  const month = shiftMonth(monthOf(day), months);
  return `${month}-${pad(Math.min(date, daysInMonth(month)))}`;
}

/** Reads instants as civil days and months in one IANA zone. */
export type Calendar = {
  readonly zone: string;
  dayKey(at: Instant): DayKey;
  monthKey(at: Instant): MonthKey;
  /** `dayNumber(dayKey(at))` without the string. */
  dayNumber(at: Instant): number;
  /** The instant `day` begins in this zone. */
  startOfDay(day: DayKey): Date;
};

function epochMs(at: Instant): number {
  return typeof at === 'number' ? at : typeof at === 'string' ? Date.parse(at) : at.getTime();
}

const calendars = new Map<string, Calendar>();

/** One calendar per zone, so callers may ask freely. Throws a RangeError for a zone the runtime does not know. */
export function createCalendar(zone: string): Calendar {
  let calendar = calendars.get(zone);
  if (!calendar) {
    calendar = buildCalendar(zone);
    calendars.set(zone, calendar);
  }
  return calendar;
}

function buildCalendar(zone: string): Calendar {
  const format = new Intl.DateTimeFormat('en-US', {
    timeZone: zone,
    hourCycle: 'h23',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
  });

  /** Milliseconds the zone's wall clock runs ahead of UTC at `ms`. */
  function exactOffset(ms: number): number {
    const fields: Record<string, number> = {};
    for (const part of format.formatToParts(ms)) fields[part.type] = Number(part.value);
    const wall = Date.UTC(
      fields.year!,
      fields.month! - 1,
      fields.day!,
      fields.hour! % 24,
      fields.minute!,
      fields.second!,
    );
    return wall - Math.floor(ms / 1000) * 1000;
  }

  // Formatting is slow on the phone; a zone changes its offset at most once in a UTC day, so cache by day.
  const offsets = new Map<number, number | null>();
  function offset(ms: number): number {
    const bucket = Math.floor(ms / DAY_MS);
    let steady = offsets.get(bucket);
    if (steady === undefined) {
      const start = exactOffset(bucket * DAY_MS);
      steady = start === exactOffset((bucket + 1) * DAY_MS - 1000) ? start : null;
      offsets.set(bucket, steady);
    }
    return steady ?? exactOffset(ms);
  }

  // A row synced half-way can carry an unreadable date; it has no day rather than crashing a screen.
  const civilDay = (at: Instant) => {
    const ms = epochMs(at);
    return Number.isFinite(ms) ? Math.floor((ms + offset(ms)) / DAY_MS) : NaN;
  };

  return {
    zone,
    dayNumber: civilDay,
    dayKey: (at) => dayFromNumber(civilDay(at)),
    monthKey: (at) => dayFromNumber(civilDay(at)).slice(0, 7),
    startOfDay(day) {
      const wall = dayNumber(day) * DAY_MS;
      const guess = wall - offset(wall);
      return new Date(wall - offset(guess));
    },
  };
}
