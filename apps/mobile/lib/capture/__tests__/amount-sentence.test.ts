import type { MinorAmount } from '@repo/types';

import { amountSentence } from '@/lib/capture/amount-sentence';

const minor = (value: number) => value as MinorAmount;
const food = {
  name: 'Food & Dining',
  budgetMinor: minor(40000),
  spentMinor: minor(29980),
};

describe('amount sentence', () => {
  it('says what is left in the category after this expense', () => {
    expect(
      amountSentence({
        kind: 'expense',
        amountMinor: minor(1200),
        currency: 'MYR',
        category: food,
      }),
    ).toEqual({
      text: 'RM88.20 left in Food & Dining after this',
      tone: 'plain',
    });
  });

  it('warns in the over tone when the expense passes the budget', () => {
    expect(
      amountSentence({
        kind: 'expense',
        amountMinor: minor(12020),
        currency: 'MYR',
        category: food,
      }),
    ).toEqual({
      text: 'Puts Food & Dining RM20.00 over budget',
      tone: 'over',
    });
  });

  it('drops "after this" before an amount is typed', () => {
    expect(
      amountSentence({
        kind: 'expense',
        amountMinor: minor(0),
        currency: 'MYR',
        category: food,
      })?.text,
    ).toBe('RM100.20 left in Food & Dining');
  });

  it('says nothing for a category with no budget', () => {
    expect(
      amountSentence({
        kind: 'expense',
        amountMinor: minor(1200),
        currency: 'MYR',
        category: { ...food, budgetMinor: null },
      }),
    ).toBeNull();
  });

  it('adds income to the month so far, and keeps transfers out of spending', () => {
    expect(
      amountSentence({
        kind: 'income',
        amountMinor: minor(10000),
        currency: 'MYR',
        incomeThisMonthMinor: minor(455000),
      })?.text,
    ).toBe('Adds to the +RM4,550.00 in so far this month');
    expect(
      amountSentence({ kind: 'transfer', currency: 'MYR' })?.text,
    ).toBe('Between your RM wallets. Spending stays the same.');
  });
});
