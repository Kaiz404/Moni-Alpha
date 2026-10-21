import type { MinorAmount } from '@repo/types';

import {
  formatMoney,
  formatSignedMoney,
} from '@/lib/finance/format-money';

const rm = (ringgit: number) => Math.round(ringgit * 100) as MinorAmount;

describe('formatMoney', () => {
  it('writes ringgit with no space, commas, and two decimals', () => {
    expect(formatMoney(rm(1116.2), 'MYR')).toBe('RM1,116.20');
  });

  it('rounds forward-looking amounts down to whole ringgit', () => {
    expect(formatMoney(rm(100.99), 'MYR', { whole: true })).toBe('RM100');
  });

  it('marks negatives with U+2212', () => {
    expect(formatMoney(rm(-45.9), 'MYR')).toBe('−RM45.90');
  });

  it('keeps another currency in its own symbol', () => {
    expect(formatMoney(rm(120), 'USD')).toBe('$120.00');
  });
});

describe('formatSignedMoney', () => {
  it('signs expenses with U+2212 and income with a plus, and leaves transfers unsigned', () => {
    expect(formatSignedMoney('expense', rm(45.9), 'MYR')).toBe('−RM45.90');
    expect(formatSignedMoney('income', rm(4200), 'MYR')).toBe('+RM4,200.00');
    expect(formatSignedMoney('transfer', rm(100), 'MYR')).toBe('RM100.00');
  });
});
