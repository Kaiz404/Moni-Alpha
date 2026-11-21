import { describe, expect, it } from 'vitest';

import {
  addDays,
  addMonths,
  createCalendar,
  daysBetween,
  daysInMonth,
  isMonthKey,
  lastDayOf,
  parseDayKey,
  shiftMonth,
  yearsOfMonths,
  weekday,
} from '../calendar';

const kualaLumpur = createCalendar('Asia/Kuala_Lumpur');
const newYork = createCalendar('America/New_York');
const kathmandu = createCalendar('Asia/Kathmandu');

describe('a calendar reads an instant in its own zone', () => {
  it.each([
    ['2026-11-12T16:30:00.000Z', kualaLumpur, '2026-11-13'],
    ['2026-11-12T16:30:00.000Z', newYork, '2026-11-12'],
    ['2026-11-12T18:14:00.000Z', kathmandu, '2026-11-12'],
    ['2026-11-12T18:15:00.000Z', kathmandu, '2026-11-13'],
  ] as const)('%s is %s', (at, calendar, day) => {
    expect(calendar.dayKey(at)).toBe(day);
  });

  it('puts the last evening of a month in the next month only where midnight has passed', () => {
    const at = new Date('2026-10-31T20:00:00.000Z');
    expect(kualaLumpur.monthKey(at)).toBe('2026-11');
    expect(newYork.monthKey(at)).toBe('2026-10');
  });

  it('takes epoch milliseconds as well as dates and strings', () => {
    expect(newYork.dayKey(Date.parse('2026-03-08T04:59:59.000Z'))).toBe('2026-03-07');
    expect(newYork.dayKey(new Date('2026-03-08T05:00:00.000Z'))).toBe('2026-03-08');
  });

  it('counts a civil day number that agrees with the day key', () => {
    expect(kualaLumpur.dayNumber('2026-01-01T00:30:00+08:00')).toBe(20454);
    expect(newYork.dayNumber('2026-01-01T00:30:00+08:00')).toBe(20453);
  });
});

describe('startOfDay', () => {
  it('is local midnight in each zone', () => {
    expect(kualaLumpur.startOfDay('2026-11-13').toISOString()).toBe('2026-11-12T16:00:00.000Z');
    expect(newYork.startOfDay('2026-11-13').toISOString()).toBe('2026-11-13T05:00:00.000Z');
  });

  it('follows daylight saving on both sides of the change', () => {
    expect(newYork.startOfDay('2026-03-08').toISOString()).toBe('2026-03-08T05:00:00.000Z');
    expect(newYork.startOfDay('2026-03-09').toISOString()).toBe('2026-03-09T04:00:00.000Z');
    expect(newYork.startOfDay('2026-11-01').toISOString()).toBe('2026-11-01T04:00:00.000Z');
    expect(newYork.startOfDay('2026-11-02').toISOString()).toBe('2026-11-02T05:00:00.000Z');
  });

  it('round-trips through dayKey', () => {
    for (const calendar of [kualaLumpur, newYork, kathmandu]) {
      expect(calendar.dayKey(calendar.startOfDay('2026-03-08'))).toBe('2026-03-08');
    }
  });
});

describe('wallTime', () => {
  it("is the instant the zone's clock reads a time of day", () => {
    expect(kualaLumpur.wallTime('2026-10-14', 12 * 3600 + 41 * 60).toISOString()).toBe('2026-10-14T04:41:00.000Z');
    expect(kathmandu.wallTime('2026-10-14', 9 * 3600).toISOString()).toBe('2026-10-14T03:15:00.000Z');
  });

  it('reads the clock after a daylight saving change on the day it happens', () => {
    expect(newYork.wallTime('2026-03-08', 1 * 3600).toISOString()).toBe('2026-03-08T06:00:00.000Z');
    expect(newYork.wallTime('2026-03-08', 13 * 3600).toISOString()).toBe('2026-03-08T17:00:00.000Z');
  });
});

it('gives an unreadable instant no day instead of throwing', () => {
  expect([
    kualaLumpur.dayKey('not a date'),
    kualaLumpur.monthKey(''),
    newYork.dayNumber(NaN),
  ]).toEqual(['', '', NaN]);
});

it('refuses a zone the runtime does not know', () => {
  expect(() => createCalendar('Mars/Olympus_Mons')).toThrow(RangeError);
});

describe('civil arithmetic', () => {
  it('counts days across a daylight saving change as whole days', () => {
    expect(daysBetween('2026-03-07', '2026-03-09')).toBe(2);
    expect(daysBetween('2026-03-09', '2026-03-07')).toBe(-2);
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });

  it('knows month lengths and leap years', () => {
    expect([daysInMonth('2026-02'), daysInMonth('2028-02'), daysInMonth('2026-10')]).toEqual([
      28, 29, 31,
    ]);
    expect(lastDayOf('2026-09')).toBe('2026-09-30');
  });

  it('shifts months across the year', () => {
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
    expect(shiftMonth('2026-11', 14)).toBe('2028-01');
  });

  it('lays out a month picker a year a page', () => {
    const years = yearsOfMonths('2025-11', '2026-02');
    expect(years.map((each) => each.year)).toEqual(['2025', '2026']);
    expect(years[1]?.months).toEqual([
      '2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06',
      '2026-07', '2026-08', '2026-09', '2026-10', '2026-11', '2026-12',
    ]);
  });

  it('clamps a monthly day to the shorter month', () => {
    expect(addMonths('2026-01-31', 1, 31)).toBe('2026-02-28');
    expect(addMonths('2026-01-15', 1, 1)).toBe('2026-02-01');
  });

  it('names weekdays from Sunday', () => {
    expect(weekday('2026-11-15')).toBe(0);
    expect(weekday('1969-12-31')).toBe(3);
  });

  it('parses only real days and months', () => {
    expect(parseDayKey(' 2026-02-28 ')).toBe('2026-02-28');
    expect(parseDayKey('2026-02-30')).toBeNull();
    expect(parseDayKey('28/02/2026')).toBeNull();
    expect([isMonthKey('2026-12'), isMonthKey('2026-13'), isMonthKey(undefined)]).toEqual([
      true,
      false,
      false,
    ]);
  });
});
