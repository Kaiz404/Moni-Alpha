const { pinClock } = require('../pinned-clock.core');

describe('pinClock', () => {
  const RealDate = Date;
  afterEach(() => {
    globalThis.Date = RealDate;
  });

  it('moves new Date() and Date.now() to the pinned day and keeps explicit dates', () => {
    pinClock('2026-10-14T14:06:00+08:00');
    expect(new Date().toISOString().slice(0, 13)).toBe('2026-10-14T06');
    expect(new Date(Date.now()).toISOString().slice(0, 10)).toBe('2026-10-14');
    expect(new Date('2026-01-02T00:00:00Z').toISOString()).toBe('2026-01-02T00:00:00.000Z');
    expect(new Date(2026, 0, 2).getDate()).toBe(2);
  });

  it('keeps instanceof, parse, UTC and the bare call', () => {
    pinClock('2026-10-14T14:06:00+08:00');
    expect(new Date()).toBeInstanceOf(Date);
    expect(Date.parse('2026-01-02T00:00:00Z')).toBe(1767312000000);
    expect(Date.UTC(2026, 0, 2)).toBe(1767312000000);
    expect(Date()).toContain('2026');
  });
});
