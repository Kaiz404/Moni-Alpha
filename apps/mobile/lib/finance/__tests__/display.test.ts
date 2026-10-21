import {
  formatDay,
  formatDayHeading,
  formatMoney,
  formatSignedMoney,
  formatWholeMoney,
  localDayKey,
} from '@/lib/finance/display';

describe('money display', () => {
  it('writes ringgit with no space and thousands commas', () => {
    expect(formatMoney(111620, 'MYR')).toBe('RM1,116.20');
  });

  it('signs expenses with U+2212 and income with a plus, and leaves transfers unsigned', () => {
    expect(formatSignedMoney('expense', 4590, 'MYR')).toBe('−RM45.90');
    expect(formatSignedMoney('income', 420000, 'MYR')).toBe('+RM4,200.00');
    expect(formatSignedMoney('transfer', 10000, 'MYR')).toBe('RM100.00');
  });

  it('keeps another currency in its own symbol', () => {
    expect(formatMoney(12000, 'USD')).toBe('$120.00');
  });

  it('rounds forward-looking money down to whole units', () => {
    expect(formatWholeMoney(2099, 'MYR')).toBe('RM20');
    expect(formatWholeMoney(-2099, 'MYR')).toBe('RM20');
  });
});

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
