import { createCalendar } from '@repo/core';
import { describe, expect, it } from 'vitest';
import { rowWhen } from '../format';

describe('rowWhen', () => {
  const calendar = createCalendar('Asia/Kuala_Lumpur');
  const now = new Date('2026-10-14T07:00:00Z');

  it('says the time today, then Yesterday, then the day', () => {
    expect(rowWhen('2026-10-14T11:31:00Z', now, calendar)).toBe('7:31 pm');
    expect(rowWhen('2026-10-13T04:41:00Z', now, calendar)).toBe('Yesterday');
    expect(rowWhen('2026-10-12T04:41:00Z', now, calendar)).toBe('Mon 12 Oct');
  });
});
