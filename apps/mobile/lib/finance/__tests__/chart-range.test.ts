import { chartWindow } from '../chart-range';

const now = new Date(2026, 0, 14, 14, 6);

describe('chartWindow', () => {
  it('steps 1M back by calendar month, across the new year', () => {
    expect([0, 1, 2].map((back) => chartWindow(now, '1m', back))).toEqual([
      { start: '2026-01-01', end: '2026-01-14' },
      { start: '2025-12-01', end: '2025-12-31' },
      { start: '2025-11-01', end: '2025-11-30' },
    ]);
  });

  it('ends each older window the day before the newer one starts', () => {
    expect(chartWindow(now, '7d', 1)).toEqual({ start: '2026-01-01', end: '2026-01-07' });
    expect(chartWindow(now, '1y', 1)).toEqual({ start: '2024-01-13', end: '2025-01-13' });
  });

  it('has no older window on All', () => {
    expect(chartWindow(now, 'all', 3)).toEqual({ start: null, end: '2026-01-14' });
  });
});
