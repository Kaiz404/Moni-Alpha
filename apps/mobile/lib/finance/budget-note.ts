import type { MinorAmount } from '@repo/types';

import { formatMoney } from '@/lib/finance/format-money';

export type BudgetNote = {
  label: string;
  /** `near` is 75% or more of the budget; `quiet` is a category with nothing spent and no budget. */
  tone: 'plain' | 'near' | 'over' | 'quiet';
  /** Spent ÷ budget clamped to 1, or null when there is no budget to draw a bar for. */
  ratio: number | null;
};

const NEAR_LIMIT = 0.75;

/** The one progress label from tokens.md: "RM100 left", "RM20 over", else what was spent. */
export function budgetNote(
  spentMinor: MinorAmount,
  budgetMinor: MinorAmount | null,
  currency: string,
): BudgetNote {
  if (budgetMinor == null || budgetMinor <= 0) {
    return spentMinor > 0
      ? { label: `${formatMoney(spentMinor, currency)} spent`, tone: 'plain', ratio: null }
      : { label: 'Nothing yet', tone: 'quiet', ratio: null };
  }
  const left = budgetMinor - spentMinor;
  if (left < 0) {
    return {
      label: `${formatMoney(-left, currency, { whole: true })} over`,
      tone: 'over',
      ratio: 1,
    };
  }
  const ratio = spentMinor / budgetMinor;
  return {
    label: `${formatMoney(left, currency, { whole: true })} left`,
    tone: ratio >= NEAR_LIMIT ? 'near' : 'plain',
    ratio,
  };
}
