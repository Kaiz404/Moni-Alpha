import { describe, expect, it } from 'vitest';

import { budgetSuggestResultSchema } from '../budget-suggest';

const suggestion = (amountMinor: number) => ({ status: 'ok', step: 'suggestion', amountMinor, note: 'Fits.', modelId: 'm' });

describe('budgetSuggestResultSchema', () => {
  it('keeps a suggestion under the plan limit and brings a larger one down to 99,999', () => {
    expect([45_200, 9_999_900, 10_000_000, 999_999_900].map((amount) => budgetSuggestResultSchema.parse(suggestion(amount)))).toEqual([
      suggestion(45_200),
      suggestion(9_999_900),
      suggestion(9_999_900),
      suggestion(9_999_900),
    ]);
  });
});
