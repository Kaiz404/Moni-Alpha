import type { ReactNode } from 'react';
import { Text, View } from 'react-native';

import { CategoryIcon } from '@/components/categories/category-icon';
import { BudgetProgressBar } from '@/components/charts/budget-progress-bar';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { formatMinorAmount } from '@/lib/finance/money';
import type { BudgetProgress } from '@/lib/finance/selectors';

type BudgetProgressItemProps = {
  budget: BudgetProgress;
  variant?: 'compact' | 'detailed';
  showArchived?: boolean;
  padded?: boolean;
  children?: ReactNode;
};

/**
 * Shared budget category presentation for Home, Summary, and the Budget screen.
 * Parents provide navigation and expansion behavior so the item stays reusable.
 */
export function BudgetProgressItem({
  budget,
  variant = 'compact',
  showArchived = false,
  padded = true,
  children,
}: BudgetProgressItemProps) {
  const tokens = useThemeTokens();
  const accent = budget.categoryColor ?? tokens.primary;
  const detailed = variant === 'detailed';
  const over = budget.status === 'over';
  const context =
    budget.budgetAmountMinor === null
      ? 'No cap set'
      : `(${formatMinorAmount(budget.spentMinor, budget.currency)} / ${formatMinorAmount(budget.budgetAmountMinor, budget.currency)})`;
  const percentageLabel =
    budget.percentage === null
      ? '—'
      : `${Math.round(budget.percentage)}%`;
  const overAmountLabel =
    over && budget.remainingMinor !== null
      ? ` · ${formatMinorAmount(Math.abs(Number(budget.remainingMinor)), budget.currency)} over`
      : null;
  const remainingMinor =
    detailed && !over ? budget.remainingMinor : null;

  return (
    <View
      className={detailed ? 'p-4' : padded ? 'px-4 py-4' : 'py-4'}
    >
      <View className="flex-row items-center justify-between">
        <View className="h-11 min-w-0 flex-1 flex-row items-center">
          <View
            className={'mr-2 h-11 w-11 items-center justify-center rounded-full'}
            style={{
              backgroundColor: detailed ? `${accent}` : `${accent}`,
            }}
          >
            <CategoryIcon
              color={tokens.foreground}
              icon={budget.categoryIcon}
              size={detailed ? 21 : 18}
            />
          </View>
          <View className="h-full min-w-0 flex-1 items-stretch justify-between">
            <View className="flex-row items-center justify-between">
              <Text
                className={
                  detailed
                    ? `text-[15px] font-semibold ${over ? 'text-danger' : 'text-foreground'}`
                    : `text-base font-semibold ${over ? 'text-danger' : 'text-foreground'}`
                }
                numberOfLines={1}
              >
                {budget.categoryName}
                {overAmountLabel ? (
                  <Text className="text-xs font-semibold text-danger">
                    {overAmountLabel}
                  </Text>
                ) : null}
                {showArchived && !budget.categoryIsActive ? (
                  <Text className="ml-2 text-xs font-semibold text-muted">
                    Archived
                  </Text>
                ) : null}
              </Text>

              <Text
                className={`text-xs font-semibold ${over ? 'text-danger' : 'text-muted'}`}
              >
                {context}
              </Text>
            </View>
            
            <BudgetProgressBar
              percentage={budget.percentage}
              color={accent}
              label={percentageLabel}
            />
          </View>
        </View>
        <View className="ml-3 flex-row items-center gap-2">
          {detailed ? (
            <CategoryIcon
              color={tokens.muted}
              icon="chevron-right"
              size={21}
            />
          ) : null}
        </View>
      </View>
    </View>
  );
}
