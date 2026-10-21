import { dayLabel, toLocalDateInput } from '@/lib/dates/local-date-input';

const now = new Date(2026, 9, 14, 14, 6);

describe('dayLabel', () => {
  it('names the last two days', () => {
    expect(dayLabel('2026-10-14', now)).toBe('Today');
    expect(dayLabel('2026-10-13', now)).toBe('Yesterday');
  });

  it('writes older days day first', () => {
    expect(dayLabel('2026-10-12', now)).toBe('Mon 12 Oct');
    expect(dayLabel('2026-09-30', now)).toBe('Wed 30 Sep');
  });
});

describe('toLocalDateInput', () => {
  it('uses the local calendar day, not the UTC one', () => {
    expect(toLocalDateInput(new Date(2026, 0, 1, 0, 30))).toBe('2026-01-01');
  });
});
