import type { MinorAmount } from '@repo/types';
import { describe, expect, it } from 'vitest';

import { createCalendar, daysBetween } from '../calendar';
import type { ChartRange } from '../chart-range';
import {
  chartTicks,
  dateLabel,
  dayHeading,
  dayLabel,
  dueWhen,
  dueWords,
  formatMoney,
  formatSignedMoney,
  monthName,
  monthShort,
} from '../glossary';

const rm = (ringgit: number) => Math.round(ringgit * 100) as MinorAmount;

describe('formatMoney', () => {
  it('writes ringgit with no space, commas, and two decimals', () => {
    expect(formatMoney(rm(1116.2), 'MYR')).toBe('RM1,116.20');
  });

  it('rounds forward-looking amounts down to whole ringgit', () => {
    expect(formatMoney(rm(100.99), 'MYR', { whole: true })).toBe('RM100');
  });

  it('marks negatives with U+2212', () => {
    expect(formatMoney(rm(-45.9), 'MYR')).toBe('−RM45.90');
  });

  it('keeps another currency in its own symbol', () => {
    expect(formatMoney(rm(120), 'USD')).toBe('$120.00');
  });
});

describe('formatSignedMoney', () => {
  it('signs expenses with U+2212 and income with a plus, and leaves transfers unsigned', () => {
    expect(formatSignedMoney('expense', rm(45.9), 'MYR')).toBe('−RM45.90');
    expect(formatSignedMoney('income', rm(4200), 'MYR')).toBe('+RM4,200.00');
    expect(formatSignedMoney('transfer', rm(100), 'MYR')).toBe('RM100.00');
  });
});

describe('day words', () => {
  const today = '2026-10-14';

  it('names the last two days', () => {
    expect(dayLabel('2026-10-14', today)).toBe('Today');
    expect(dayLabel('2026-10-13', today)).toBe('Yesterday');
  });

  it('writes older days day first, with the year only outside this one', () => {
    expect(dayLabel('2026-10-12', today)).toBe('Mon 12 Oct');
    expect(dayLabel('2026-09-30', today)).toBe('Wed 30 Sep');
    expect(dayLabel('2025-10-14', today)).toBe('Tue 14 Oct 2025');
  });

  it('heads a day group with the relative day and the date', () => {
    expect(dayHeading('2026-10-14', today)).toBe('Today · Wed 14 Oct');
    expect(dayHeading('2026-10-12', today)).toBe('Mon 12 Oct');
  });

  it('labels one instant by the day each zone is on', () => {
    const at = '2026-10-13T17:30:00.000Z';
    const label = (zone: string) => {
      const calendar = createCalendar(zone);
      return dayLabel(calendar.dayKey(at), calendar.dayKey('2026-10-14T06:00:00.000Z'));
    };
    expect(label('Asia/Kuala_Lumpur')).toBe('Today');
    expect(label('America/New_York')).toBe('Yesterday');
  });
});

describe('due phrases', () => {
  it('says when a bill is due', () => {
    expect(dueWhen('2026-10-12', '2026-10-14')).toBe('today');
    expect(dueWhen('2026-10-14', '2026-10-14')).toBe('today');
    expect(dueWhen('2026-10-15', '2026-10-14')).toBe('tomorrow');
    expect(dueWhen('2026-10-16', '2026-10-14')).toBe('on Fri 16 Oct');
    expect(dueWhen('2027-01-02', '2026-10-14')).toBe('on Sat 2 Jan 2027');
  });

  it('counts down to a debt and then counts the days late', () => {
    expect([6, 1, 0, -1, -3].map(dueWords)).toEqual([
      'In 6 days',
      'Tomorrow',
      'Today',
      '1 day late',
      '3 days late',
    ]);
  });
});

describe('months', () => {
  it('names a month in full and short', () => {
    expect([monthName('2026-09'), monthShort('2026-09'), monthName('2026-01')]).toEqual([
      'September',
      'Sep',
      'January',
    ]);
  });

  it('dates across the year with the year', () => {
    expect(dateLabel('2025-12-31', '2026-01-01')).toBe('Wed 31 Dec 2025');
  });
});

/** Labels for `first` to `last`, on an index that starts a while before. */
function labels(range: ChartRange, first: string, last: string): string[] {
  const firstDay = '2023-01-01';
  return chartTicks({
    range,
    firstDay,
    first: daysBetween(firstDay, first),
    last: daysBetween(firstDay, last),
  }).map((tick) => tick.label);
}

describe('chartTicks', () => {
  it('7D marks every day by weekday', () => {
    expect(labels('7d', '2026-11-06', '2026-11-12')).toEqual([
      'Fri',
      'Sat',
      'Sun',
      'Mon',
      'Tue',
      'Wed',
      'Thu',
    ]);
  });

  it('30D marks every Monday with its date', () => {
    expect(labels('30d', '2026-10-14', '2026-11-12')).toEqual([
      '19 Oct',
      '26 Oct',
      '2 Nov',
      '9 Nov',
    ]);
  });

  it('1M marks the 1st, 8th, 15th, 22nd and 29th, naming the month only on the 1st', () => {
    expect(labels('1m', '2026-11-01', '2026-11-30')).toEqual(['1 Nov', '8', '15', '22', '29']);
  });

  it('90D marks each month', () => {
    expect(labels('90d', '2026-08-15', '2026-11-12')).toEqual(['Sep', 'Oct', 'Nov']);
  });

  it('1Y marks each quarter, with the year on January', () => {
    expect(labels('1y', '2025-11-12', '2026-11-12')).toEqual(['Jan 2026', 'Apr', 'Jul', 'Oct']);
  });

  it('All marks each new year, or each quarter when the data spans under 13 months', () => {
    expect(labels('all', '2023-06-15', '2026-11-12')).toEqual(['2024', '2025', '2026']);
    expect(labels('all', '2026-03-10', '2026-11-12')).toEqual(['Apr', 'Jul', 'Oct']);
  });

  it('anchors each tick to its day in the index', () => {
    const ticks = chartTicks({ range: '90d', firstDay: '2026-08-30', first: 0, last: 40 });
    expect(ticks).toEqual([
      { day: 2, label: 'Sep' },
      { day: 32, label: 'Oct' },
    ]);
  });
});
