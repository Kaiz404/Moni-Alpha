import { daysBetween, type ChartRange } from '@/lib/finance/chart-range';
import { chartTicks } from '@/lib/finance/chart-ticks';

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
    expect(labels('7d', '2026-11-06', '2026-11-12')).toEqual(['Fri', 'Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu']);
  });

  it('30D marks every Monday with its date', () => {
    expect(labels('30d', '2026-10-14', '2026-11-12')).toEqual(['19 Oct', '26 Oct', '2 Nov', '9 Nov']);
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
