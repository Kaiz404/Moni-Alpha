import { extractDateContext, resolveOccurredAt, toLocalIsoWithOffset } from '@/lib/ai/occurred-at';

const now = new Date(2026, 9, 12, 9, 30);

describe('resolveOccurredAt', () => {
  it('keeps "now" when the input names no usable date', () => {
    for (const value of [null, undefined, '', 'last friday', '2026-13-01', '2026-02-30']) {
      expect(resolveOccurredAt(value, now)).toBe(now.toISOString());
    }
  });

  it('keeps "now" for today and for future dates', () => {
    expect(resolveOccurredAt('2026-10-12', now)).toBe(now.toISOString());
    expect(resolveOccurredAt('2026-10-13', now)).toBe(now.toISOString());
    expect(resolveOccurredAt('2027-01-01', now)).toBe(now.toISOString());
  });

  it('dates past days at local noon', () => {
    expect(resolveOccurredAt('2026-10-11', now)).toBe(new Date(2026, 9, 11, 12).toISOString());
    expect(resolveOccurredAt('2026-07-15', now)).toBe(new Date(2026, 6, 15, 12).toISOString());
  });

  it('clamps dates older than 90 days', () => {
    const earliest = new Date(now.getTime() - 90 * 86400000).toISOString();
    expect(resolveOccurredAt('2025-10-12', now)).toBe(earliest);
    expect(resolveOccurredAt('2026-07-14', now)).toBe(new Date(2026, 6, 14, 12).toISOString());
  });
});

describe('extractDateContext', () => {
  it('sends local wall time with its UTC offset', () => {
    const { clientNow } = extractDateContext(now);
    expect(clientNow).toMatch(/^2026-10-12T09:30:00[+-]\d{2}:\d{2}$/);
    expect(new Date(clientNow!).getTime()).toBe(now.getTime());
    expect(toLocalIsoWithOffset(now)).toBe(clientNow);
  });
});
