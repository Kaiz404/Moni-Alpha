import { dayLabel, formatDay, formatDayHeading } from '@/lib/dates/day-label';
import { toLocalDateInput } from '@/lib/dates/local-date-input';

const now = new Date(2026, 9, 14, 14, 6);

describe('dayLabel', () => {
  it('names the last two days', () => {
    expect(dayLabel('2026-10-14', now)).toBe('Today');
    expect(dayLabel('2026-10-13', now)).toBe('Yesterday');
  });

  it('writes older days day first, with the year only outside this one', () => {
    expect(dayLabel('2026-10-12', now)).toBe('Mon 12 Oct');
    expect(dayLabel('2026-09-30', now)).toBe('Wed 30 Sep');
    expect(dayLabel('2025-10-14', now)).toBe('Tue 14 Oct 2025');
  });
});

describe('formatDay', () => {
  it('reads a timestamp by its local calendar day', () => {
    expect(formatDay(new Date(2026, 9, 14, 0, 5), now)).toBe('Today');
    expect(formatDay(new Date(2026, 9, 13, 23, 59), now)).toBe('Yesterday');
    expect(formatDay(new Date(2026, 8, 9, 12), now)).toBe('Wed 9 Sep');
  });
});

describe('formatDayHeading', () => {
  it('heads a day group with the relative day and the date', () => {
    expect(formatDayHeading(new Date(2026, 9, 14, 9), now)).toBe('Today · Wed 14 Oct');
    expect(formatDayHeading(new Date(2026, 9, 12, 9), now)).toBe('Mon 12 Oct');
  });
});

describe('toLocalDateInput', () => {
  it('uses the local calendar day, not the UTC one', () => {
    expect(toLocalDateInput(new Date(2026, 0, 1, 0, 30))).toBe('2026-01-01');
  });
});
