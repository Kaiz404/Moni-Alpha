import type { MinorAmount } from '@repo/types';

import type { AmountSentence } from '@/lib/amount/amount-input';
import { currencySymbol, formatMoney } from '@/lib/finance/format-money';


export type AmountSentenceInput =
  | {
      kind: 'expense';
      amountMinor: MinorAmount;
      currency: string;
      /** This month's budget and spending for the picked category, or null with no category. */
      category: {
        name: string;
        budgetMinor: MinorAmount | null;
        spentMinor: MinorAmount;
      } | null;
    }
  | {
      kind: 'income';
      amountMinor: MinorAmount;
      currency: string;
      incomeThisMonthMinor: MinorAmount;
    }
  | { kind: 'transfer'; currency: string };

/** The line under the amount on V2A-CaptureType, or null when there is nothing worth saying. */
export function amountSentence(
  input: AmountSentenceInput,
): AmountSentence | null {
  switch (input.kind) {
    case 'expense': {
      const category = input.category;
      if (!category || category.budgetMinor == null) return null;
      const left =
        category.budgetMinor - category.spentMinor - input.amountMinor;
      if (left < 0) {
        return {
          text: `Puts ${category.name} ${formatMoney(-left, input.currency)} over budget`,
          tone: 'over',
        };
      }
      const after = input.amountMinor > 0 ? ' after this' : '';
      return {
        text: `${formatMoney(left, input.currency)} left in ${category.name}${after}`,
        tone: 'plain',
      };
    }
    case 'income':
      return input.incomeThisMonthMinor > 0
        ? {
            text: `Adds to the +${formatMoney(input.incomeThisMonthMinor, input.currency)} in so far this month`,
            tone: 'plain',
          }
        : null;
    case 'transfer':
      return {
        text: `Between your ${currencySymbol(input.currency)} wallets. Spending stays the same.`,
        tone: 'plain',
      };
  }
}
