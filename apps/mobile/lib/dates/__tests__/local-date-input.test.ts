import { isoToLocalDateInput } from '@/lib/dates/local-date-input';

describe('isoToLocalDateInput', () => {
  it('reads the local day, not the UTC day, early in the Malaysian morning', () => {
    expect(isoToLocalDateInput('2026-11-12T16:30:00.000Z')).toBe('2026-11-13');
  });

  it('falls back to the local day of the fallback for a missing or invalid date', () => {
    const fallback = new Date('2026-11-12T17:00:00.000Z');
    expect(isoToLocalDateInput(null, fallback)).toBe('2026-11-13');
    expect(isoToLocalDateInput('not a date', fallback)).toBe('2026-11-13');
  });
});
