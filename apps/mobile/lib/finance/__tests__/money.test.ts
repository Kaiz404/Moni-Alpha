import { decimalToMinor, formatMinorAmount, minorToDecimal } from '@repo/types';

describe('minor-unit money', () => {
  it('round-trips DECIMAL(12,2) values without float arithmetic', () => {
    expect(decimalToMinor('12.34')).toBe(1234);
    expect(decimalToMinor('0.1')).toBe(10);
    expect(minorToDecimal(1234)).toBe('12.34');
  });

  it('rejects values with unsupported precision', () => {
    expect(() => decimalToMinor('1.001')).toThrow('Invalid decimal amount');
    expect(() => decimalToMinor(1.005)).toThrow('Invalid decimal amount');
  });

  it('formats only at the render boundary', () => {
    expect(formatMinorAmount(1234, 'USD')).toContain('12.34');
  });
});
