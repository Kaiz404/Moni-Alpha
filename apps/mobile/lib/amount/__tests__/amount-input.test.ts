import {
  pressAmountKey,
  readAmount,
  type AmountKey,
} from '@/lib/amount/amount-input';

const type = (keys: AmountKey[], from = '') =>
  keys.reduce(pressAmountKey, from);

describe('amount input', () => {
  it('holds two decimals: 1 2 . 5 0 7 reads 12.50', () => {
    const typed = type(['1', '2', '.', '5', '0', '7']);

    expect(readAmount(typed)).toEqual({
      display: '12.50',
      value: 12.5,
      minor: 1250,
    });
  });

  it('removes the last character on backspace', () => {
    expect(readAmount(type(['back'], '12.50')).display).toBe('12.5');
  });

  it('ignores a tenth digit before the point', () => {
    expect(
      type(['1', '2', '3', '4', '5', '6', '7', '8', '9', '1']),
    ).toBe('123456789');
  });

  it('groups thousands and reads an empty amount as 0', () => {
    expect(readAmount('1250.5').display).toBe('1,250.5');
    expect(readAmount('')).toEqual({ display: '0', value: 0, minor: 0 });
  });

  it('reads a trailing point as the whole amount', () => {
    expect(readAmount(type(['2', '0', '.']))).toEqual({
      display: '20.',
      value: 20,
      minor: 2000,
    });
  });

  it('starts a lone point as 0. and replaces a leading zero', () => {
    expect(type(['.', '5'])).toBe('0.5');
    expect(type(['0', '7'])).toBe('7');
    expect(type(['.', '.'])).toBe('0.');
  });
});
