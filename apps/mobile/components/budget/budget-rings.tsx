import { router } from 'expo-router';
import { View } from 'react-native';

import { Ring } from '@/components/budget/ring';
import { EmptyTile } from '@/components/ui/empty-tile';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Press } from '@/components/ui/press';
import { Text } from '@/components/ui/text';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import type { CategorySpend } from '@/lib/finance/budget-month';
import { tid } from '@/lib/test-ids';

type BudgetRingsProps = {
  budgeted: readonly CategorySpend[];
  unbudgeted: readonly CategorySpend[];
  currency: string;
  month: string;
  /** Why setting budgets helps, from the user's own months; null when there is no history. */
  emptyBody: string;
};

function RingGrid({
  rows,
  currency,
  month,
}: {
  rows: readonly CategorySpend[];
  currency: string;
  month: string;
}) {
  return (
    <View className="flex-row flex-wrap">
      {rows.map((row) => (
        <View
          key={row.categoryId}
          style={{ width: `${100 / 6}%` }}
        >
          <Ring
            testID={tid('budget', 'ring', row.name)}
            name={row.name}
            icon={row.icon}
            color={row.color}
            spentMinor={row.spentMinor}
            budgetMinor={row.budgetMinor}
            currency={currency}
            onPress={() =>
              router.push({
                pathname: '/budget/[categoryId]',
                params: { categoryId: row.categoryId, month },
              })
            }
          />
        </View>
      ))}
    </View>
  );
}

/** "Budgets" on the tab root: a ring per budget, then categories spent with no budget yet. */
export function BudgetRings({
  budgeted,
  unbudgeted,
  currency,
  month,
  emptyBody,
}: BudgetRingsProps) {
  const tokens = useThemeTokens();
  const openEdit = () => router.push('/budget/edit');
  return (
    <View className="gap-2">
      {budgeted.length ? (
        <Press
          testID={tid('budget', 'edit-budgets')}
          accessibilityRole="button"
          accessibilityLabel="Budgets. Edit budgets"
          onPress={openEdit}
          className="min-h-11 flex-row items-center gap-0.5 self-start rounded-field pr-1"
        >
          <Text
            variant="sectionTitle"
            className="text-foreground"
          >
            Budgets
          </Text>
          <IconSymbol
            name="chevron-right"
            size={22}
            color={tokens.muted}
          />
        </Press>
      ) : (
        <Text
          variant="sectionTitle"
          className="text-foreground"
          accessibilityRole="header"
        >
          Budgets
        </Text>
      )}
      {budgeted.length ? (
        <View className="gap-1.5 rounded-card bg-card px-2.5 py-3">
          <RingGrid
            rows={budgeted}
            currency={currency}
            month={month}
          />
          {unbudgeted.length ? (
            <>
              <Text
                variant="caps"
                className="px-2 pt-1 text-muted"
              >
                No budget yet
              </Text>
              <RingGrid
                rows={unbudgeted}
                currency={currency}
                month={month}
              />
            </>
          ) : null}
        </View>
      ) : (
        <EmptyTile
          icon="chart-box"
          title="No budgets yet"
          body={emptyBody}
          action={{
            testID: tid('budget', 'set-budgets'),
            label: 'Set budgets',
            icon: 'plus',
            onPress: openEdit,
          }}
        />
      )}
    </View>
  );
}
