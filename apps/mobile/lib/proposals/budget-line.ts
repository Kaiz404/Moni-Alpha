import type { MinorAmount } from '@repo/types';

import { formatMoney } from '@/lib/finance/format-money';
import type { BudgetProgress } from '@/lib/finance/selectors';

export type BudgetTone = 'onTrack' | 'near' | 'over' | 'review';
export type BudgetLine = { tone: BudgetTone; text: string };

/**
 * What approving does to the category's month, as `XA-Review` words it: "Food & Dining: RM76
 * left after this", Lemon once less than 15% of the budget is left. The review card and the
 * Approved notification both show it. Forward-looking money is whole ringgit, rounded down.
 */
export function budgetLine(
  categoryName: string,
  progress: BudgetProgress | undefined,
  amountMinor: MinorAmount,
  currency: string,
): BudgetLine {
  const budget = progress?.budgetAmountMinor ?? null;
  if (budget === null) return { tone: 'review', text: `No budget for ${categoryName} yet` };
  const spent = Number(progress?.spentMinor ?? 0);
  const left = Number(budget) - spent - Number(amountMinor);
  const money = (minor: number) => formatMoney(minor, currency, { whole: true });
  if (left < 0) {
    return spent > Number(budget)
      ? { tone: 'over', text: `${categoryName}: ${money(-left)} over after this` }
      : { tone: 'over', text: `${categoryName} goes ${money(-left)} over` };
  }
  return {
    tone: left < Number(budget) * 0.15 ? 'near' : 'onTrack',
    text: `${categoryName}: ${money(left)} left after this`,
  };
}
