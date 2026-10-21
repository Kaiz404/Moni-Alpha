import type { MinorAmount } from '@repo/types';

import { StatusPill, type StatusTone } from '@/components/ui/status-pill';
import { formatMoney } from '@/lib/finance/format-money';
import type { BudgetProgress } from '@/lib/finance/selectors';

export type BudgetLine = { tone: StatusTone; text: string };

/**
 * What approving does to the category's month: "Food & Dining: RM76 left after this".
 * Forward-looking money is whole ringgit, rounded down.
 */
export function budgetLine(
  categoryName: string,
  progress: BudgetProgress | undefined,
  amountMinor: MinorAmount,
  currency: string,
): BudgetLine {
  const budget = progress?.budgetAmountMinor ?? null;
  if (budget === null) return { tone: 'auto', text: `No budget for ${categoryName} yet` };
  const spent = Number(progress?.spentMinor ?? 0);
  const after = spent + Number(amountMinor);
  const money = (minor: number) => formatMoney(minor, currency, { whole: true });
  if (after > Number(budget)) {
    const over = after - Number(budget);
    return spent > Number(budget)
      ? { tone: 'over', text: `${categoryName}: ${money(over)} over after this` }
      : { tone: 'over', text: `${categoryName} goes ${money(over)} over` };
  }
  return {
    tone: after >= Number(budget) * 0.75 ? 'near' : 'onTrack',
    text: `${categoryName}: ${money(Number(budget) - after)} left after this`,
  };
}

export function ResultPill({ line }: { line: BudgetLine }) {
  return (
    <StatusPill
      tone={line.tone}
      label={line.text}
    />
  );
}
