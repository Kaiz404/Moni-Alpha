import type { MinorAmount } from '@repo/types';

import { budgetNote } from '@/lib/finance/budget-note';

const rm = (ringgit: number) => Math.round(ringgit * 100) as MinorAmount;

describe('budgetNote', () => {
  it('shows what is left under budget', () => {
    expect(budgetNote(rm(450), rm(1000), 'MYR')).toEqual({
      label: 'RM550 left',
      tone: 'plain',
      ratio: 0.45,
    });
  });

  it('turns the label near-limit at 75% spent', () => {
    expect(budgetNote(rm(75), rm(100), 'MYR')).toEqual({
      label: 'RM25 left',
      tone: 'near',
      ratio: 0.75,
    });
  });

  it('fills the bar and shows the overshoot when over budget', () => {
    expect(budgetNote(rm(140), rm(120), 'MYR')).toEqual({
      label: 'RM20 over',
      tone: 'over',
      ratio: 1,
    });
  });

  it('shows the spend for a category with no budget', () => {
    expect(budgetNote(rm(96.5), null, 'MYR')).toEqual({
      label: 'RM96.50 spent',
      tone: 'plain',
      ratio: null,
    });
  });

  it('says nothing yet for an untouched category with no budget', () => {
    expect(budgetNote(rm(0), null, 'MYR')).toEqual({
      label: 'Nothing yet',
      tone: 'quiet',
      ratio: null,
    });
  });
});
