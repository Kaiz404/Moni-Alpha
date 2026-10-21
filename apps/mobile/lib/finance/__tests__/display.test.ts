import {
  formatDay,
  formatDayHeading,
  localDayKey,
} from '@/lib/finance/display';

describe('day display', () => {
  const now = new Date(2026, 9, 14, 14, 6);

  it('names the last two days and writes older days day first', () => {
    expect(formatDay(new Date(2026, 9, 14, 0, 5), now)).toBe('Today');
    expect(formatDay(new Date(2026, 9, 13, 23, 59), now)).toBe('Yesterday');
    expect(formatDay(new Date(2026, 8, 9, 12), now)).toBe('Wed 9 Sep');
    expect(formatDay(new Date(2025, 9, 14, 12), now)).toBe('Tue 14 Oct 2025');
  });

  it('heads a day group with the relative day and the date', () => {
    expect(formatDayHeading(new Date(2026, 9, 14, 9), now)).toBe('Today · Wed 14 Oct');
    expect(formatDayHeading(new Date(2026, 9, 12, 9), now)).toBe('Mon 12 Oct');
  });

  it('keys a row by its local calendar day', () => {
    expect(localDayKey(new Date(2026, 0, 5, 23, 30))).toBe('2026-01-05');
  });
});
