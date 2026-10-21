import { minorToNumber } from '@repo/types';
import { correctBalance, parseBalanceInput } from '../balance-correction';

describe('correctBalance', () => {
  it('writes an expense of the difference when the real balance is lower', () => {
    const correction = correctBalance({ balance: 63.6 }, 60);
    expect(correction).toEqual({
      type: 'expense',
      amountMinor: 360,
      description: 'Balance correction',
      categoryId: null,
      merchant: null,
      analysisExcluded: true,
      metadata: { kind: 'balance_correction' },
    });
    expect(minorToNumber(correction!.amountMinor)).toBe(3.6);
  });

  it('writes an income of the difference when the real balance is higher', () => {
    const correction = correctBalance({ balance: 63.6 }, 70);
    expect(correction).toMatchObject({
      type: 'income',
      analysisExcluded: true,
      metadata: { kind: 'balance_correction' },
    });
    expect(minorToNumber(correction!.amountMinor)).toBe(6.4);
  });

  it('writes nothing when the balance is already right', () => {
    expect(correctBalance({ balance: 63.6 }, 63.6)).toBeNull();
  });

  it('corrects across zero for a card that is owed money', () => {
    expect(correctBalance({ balance: 20 }, -15.5)).toMatchObject({
      type: 'expense',
      amountMinor: 3550,
    });
  });
});

describe('parseBalanceInput', () => {
  it.each([
    ['60', 60],
    ['1,116.20', 1116.2],
    ['−15.50', -15.5],
    ['', null],
    ['12.345', null],
    ['abc', null],
  ])('reads %p as %p', (text, expected) => {
    expect(parseBalanceInput(text)).toBe(expected);
  });
});
