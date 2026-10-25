import type { MinorAmount } from '@repo/types';

import type { BudgetProgress } from '@/lib/finance/selectors';
import { budgetLine } from '@/lib/proposals/budget-line';

const food = (spent: number, budget: number | null) =>
  ({ spentMinor: spent, budgetAmountMinor: budget }) as unknown as BudgetProgress;
const rm = (ringgit: number) => Math.round(ringgit * 100) as MinorAmount;

describe('budgetLine', () => {
  it('reads what is left after this, whole ringgit, Mint while 15% or more stays', () => {
    expect(budgetLine('Food & Dining', food(34980, 45000), rm(23.4), 'MYR')).toEqual({
      tone: 'onTrack',
      text: 'Food & Dining: RM76 left after this',
    });
  });

  it('turns Lemon once less than 15% of the budget would be left', () => {
    expect(budgetLine('Food & Dining', food(38000, 45000), rm(5), 'MYR')).toEqual({
      tone: 'near',
      text: 'Food & Dining: RM65 left after this',
    });
  });

  it('says how far over it goes, and names a budget already over', () => {
    expect(budgetLine('Transport', food(11000, 12000), rm(20), 'MYR')).toEqual({
      tone: 'over',
      text: 'Transport goes RM10 over',
    });
    expect(budgetLine('Transport', food(14000, 12000), rm(6), 'MYR')).toEqual({
      tone: 'over',
      text: 'Transport: RM26 over after this',
    });
  });

  it('says so in Lilac when the category has no budget', () => {
    expect(budgetLine('Health', food(4050, null), rm(10), 'MYR')).toEqual({
      tone: 'review',
      text: 'No budget for Health yet',
    });
  });
});
