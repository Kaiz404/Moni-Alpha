import { View } from 'react-native';

import { Text } from '@/components/ui/text';
import { formatMoney } from '@/lib/finance/format-money';
import type { BudgetProgress } from '@/lib/finance/selectors';

export function BudgetLine({ budget }: { budget: BudgetProgress }) {
  if (budget.budgetAmountMinor === null || budget.remainingMinor === null) return null;
  const over = Number(budget.remainingMinor) < 0;
  const cap = formatMoney(budget.budgetAmountMinor, budget.currency, { whole: true });
  const value = formatMoney(Math.abs(Number(budget.remainingMinor)), budget.currency, {
    whole: true,
  });
  return (
    <View className="px-1" accessibilityLiveRegion="polite">
      <Text variant="body" className="text-foreground">
        {`${budget.categoryName} · `}
        <Text className={`font-display-bold ${over ? 'text-over' : 'text-deep-mint'}`}>
          {over ? `${value} over` : `${value} left`}
        </Text>
        {over ? ` its ${cap} budget` : ` of its ${cap} budget`}
      </Text>
    </View>
  );
}
