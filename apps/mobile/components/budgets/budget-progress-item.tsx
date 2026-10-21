import type { ReactNode } from 'react';
import { View } from 'react-native';

import type { IconSymbolName } from '@/components/ui/icon-symbol';
import { ProgressBar } from '@/components/ui/progress-bar';
import { Text } from '@/components/ui/text';
import { TintBubble } from '@/components/ui/transaction-row';
import { formatMoney } from '@/lib/finance/display';
import type { BudgetProgress } from '@/lib/finance/selectors';

type BudgetProgressItemProps = {
  budget: BudgetProgress;
  showArchived?: boolean;
  children?: ReactNode;
};

/**
 * One category's spending this month: its bubble, then the one progress bar
 * against its budget, or what was spent when it has no budget. Parents own
 * navigation and expansion.
 */
export function BudgetProgressItem({
  budget,
  showArchived = false,
  children,
}: BudgetProgressItemProps) {
  const title =
    showArchived && !budget.categoryIsActive
      ? `${budget.categoryName} · Archived`
      : budget.categoryName;
  return (
    <View className="flex-row items-center gap-3.5 px-[18px] py-3">
      <TintBubble
        icon={
          (budget.categoryIcon || 'shape-outline') as IconSymbolName
        }
        color={budget.categoryColor}
      />
      <View className="min-w-0 flex-1">
        {budget.budgetAmountMinor === null ? (
          <View className="flex-row items-center justify-between gap-3">
            <Text
              variant="rowTitle"
              className="min-w-0 flex-1 text-foreground"
              numberOfLines={1}
            >
              {title}
            </Text>
            <Text className="text-[13px] leading-[18px] font-display-semibold text-muted">
              {formatMoney(budget.spentMinor, budget.currency)} spent
            </Text>
          </View>
        ) : (
          <ProgressBar
            title={title}
            spentMinor={budget.spentMinor}
            budgetMinor={budget.budgetAmountMinor}
            currency={budget.currency}
          />
        )}
        {children}
      </View>
    </View>
  );
}
