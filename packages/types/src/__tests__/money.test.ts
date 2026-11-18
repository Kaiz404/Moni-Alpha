import { describe, expect, it } from 'vitest';
import { decimalToMinor, minorToDecimal } from '../money';

describe('decimalToMinor', () => {
  it.each([
    ['23.40', 2340],
    [23.4, 2340],
    ['1.005', 'throws'],
    ['-5', -500],
    [null, 0],
  ] as const)('%s becomes %s', (input, expected) => {
    if (expected === 'throws') expect(() => decimalToMinor(input)).toThrow('Invalid decimal amount');
    else expect(decimalToMinor(input)).toBe(expected);
  });
});

describe('minorToDecimal', () => {
  it.each([
    [2340, '23.40'],
    [-7, '-0.07'],
    [0, '0.00'],
  ])('%s becomes %s', (input, expected) => {
    expect(minorToDecimal(input)).toBe(expected);
  });
});
