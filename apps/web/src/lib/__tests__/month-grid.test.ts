import { describe, expect, it } from 'vitest';
import { monthWeeks } from '../month-grid';

describe('monthWeeks', () => {
  it('lays November 2026 out from Monday, padding the first and last weeks', () => {
    const weeks = monthWeeks('2026-11');
    expect(weeks).toHaveLength(6);
    expect(weeks[0]).toEqual([null, null, null, null, null, null, '2026-11-01']);
    expect(weeks[1]![0]).toBe('2026-11-02');
    expect(weeks[5]).toEqual(['2026-11-30', null, null, null, null, null, null]);
  });

  it('needs only four weeks for a February that starts on Monday', () => {
    const weeks = monthWeeks('2027-02');
    expect(weeks).toHaveLength(4);
    expect(weeks[0]![0]).toBe('2027-02-01');
    expect(weeks[3]![6]).toBe('2027-02-28');
  });
});
