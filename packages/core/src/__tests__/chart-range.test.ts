import { describe, expect, it } from 'vitest';

import { createCalendar } from '../calendar';
import { chartRangeStart, chartWindow, rangeStartIndex } from '../chart-range';

describe('chartWindow', () => {
  it('steps 1M back by calendar month, across the new year', () => {
    expect([0, 1, 2].map((back) => chartWindow('2026-01-14', '1m', back))).toEqual([
      { start: '2026-01-01', end: '2026-01-14' },
      { start: '2025-12-01', end: '2025-12-31' },
      { start: '2025-11-01', end: '2025-11-30' },
    ]);
  });

  it('ends each older window the day before the newer one starts', () => {
    expect(chartWindow('2026-01-14', '7d', 1)).toEqual({ start: '2026-01-01', end: '2026-01-07' });
    expect(chartWindow('2026-01-14', '1y', 1)).toEqual({ start: '2024-01-13', end: '2025-01-13' });
  });

  it('has no older window on All', () => {
    expect(chartWindow('2026-01-14', 'all', 3)).toEqual({ start: null, end: '2026-01-14' });
  });

  it('starts from the day the zone is on', () => {
    const at = new Date('2026-10-31T20:00:00.000Z');
    expect(chartRangeStart(createCalendar('Asia/Kuala_Lumpur').dayKey(at), '1m')).toBe('2026-11-01');
    expect(chartRangeStart(createCalendar('America/New_York').dayKey(at), '1m')).toBe('2026-10-01');
  });
});

describe('chartRangeStart', () => {
  it('reaches a year back to the same date, rolling 29 Feb to 1 Mar', () => {
    expect(chartRangeStart('2028-02-29', '1y')).toBe('2027-03-01');
    expect(chartRangeStart('2026-11-19', '90d')).toBe('2026-08-22');
  });

  it('places the start in a day index', () => {
    expect(rangeStartIndex('2026-11-01', '2026-11-19', '7d')).toBe(12);
    expect(rangeStartIndex('2026-11-01', '2026-11-19', 'all')).toBeNull();
  });
});
