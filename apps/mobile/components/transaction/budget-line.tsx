import { router } from 'expo-router';
import { View } from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { Press } from '@/components/ui/press';
import { Text } from '@/components/ui/text';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { formatMoney } from '@/lib/finance/format-money';
import type { BudgetProgress } from '@/lib/finance/selectors';
import { tid } from '@/lib/test-ids';

export function BudgetLine({ budget }: { budget: BudgetProgress }) {
  const tokens = useThemeTokens();
  if (budget.budgetAmountMinor === null || budget.remainingMinor === null) return null;
  const over = Number(budget.remainingMinor) < 0;
  const cap = formatMoney(budget.budgetAmountMinor, budget.currency, { whole: true });
  const value = formatMoney(Math.abs(Number(budget.remainingMinor)), budget.currency, {
    whole: true,
  });
  const text = over ? `${value} over its ${cap} budget` : `${value} left of its ${cap} budget`;
  return (
    <Press
      testID={tid('txn', 'budget')}
      accessibilityLabel={`${budget.categoryName}, ${text}. Open the budget`}
      onPress={() =>
        router.push({
          pathname: '/budget/[categoryId]',
          params: { categoryId: budget.categoryId },
        })
      }
      className="min-h-11 flex-row items-center gap-2 rounded-field pl-1 pr-0.5"
    >
      <View className="min-w-0 flex-1" accessibilityLiveRegion="polite">
        <Text variant="body" className="text-foreground">
          {`${budget.categoryName} · `}
          <Text className={`font-display-semibold ${over ? 'text-over' : 'text-deep-mint'}`}>
            {over ? `${value} over` : `${value} left`}
          </Text>
          {over ? ` its ${cap} budget` : ` of its ${cap} budget`}
        </Text>
      </View>
      <IconSymbol name="chevron-right" size={20} color={tokens.muted} />
    </Press>
  );
}
