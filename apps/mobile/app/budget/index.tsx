import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { useValue } from '@legendapp/state/react';

import { BudgetProgressItem } from '@/components/budgets/budget-progress-item';
import { FeedbackState } from '@/components/ui/feedback-state';
import { useAuth } from '@/lib/auth/auth-context';
import { budgetProgress$ } from '@/lib/finance/selectors';
import { ensureFinanceTimezone } from '@/lib/supabase/profile';
import { HeaderIconButton } from '@/components/ui/header-icon-button';
import { tid } from '@/lib/test-ids';
import { Page } from '@/components/ui/page';

export default function BudgetsScreen() {
  const { user } = useAuth();
  const [timezone, setTimezone] = useState('UTC');
  const progress = useValue(
    budgetProgress$(user?.id ?? null, timezone),
  );
  const budgets = useMemo(
    () => progress.filter((row) => row.budgetAmountMinor !== null),
    [progress],
  );

  useEffect(() => {
    void ensureFinanceTimezone()
      .then(setTimezone)
      .catch(() => {});
  }, []);

  return (
    <Page
      screen="budget"
      kind="pushed"
      title="Monthly Budgets"
      trailing={
        <HeaderIconButton
          testID={tid('budget', 'add-budget')}
          accessibilityLabel="Add budget"
          icon="plus"
          onPress={() => router.push('/budget/form' as never)}
        />
      }
    >
      {!budgets.length ? (
        <View className="flex-1 items-center justify-center px-5">
          <FeedbackState
            icon="piggy-bank"
            title="No budgets yet"
          />
        </View>
      ) : (
        <ScrollView
          className="flex-1"
          contentContainerClassName="pb-10"
          showsVerticalScrollIndicator={false}
        >
          <View className="mt-7">
            {budgets.map((row) => {
              return (
                <Pressable
                  testID={tid(
                    'budget',
                    'edit',
                    `${row.categoryId}:${row.currency}`,
                  )}
                  key={`${row.categoryId}:${row.currency}`}
                  className="mb-3"
                  accessibilityRole="button"
                  accessibilityLabel={`Edit ${row.categoryName} budget`}
                  onPress={() =>
                    router.push({
                      pathname: '/budget/form',
                      params: {
                        categoryId: row.categoryId,
                        currency: row.currency,
                      },
                    } as never)
                  }
                >
                  <View className="rounded-card bg-card overflow-hidden">
                    <BudgetProgressItem
                      budget={row}
                      variant="detailed"
                      showArchived
                    />
                  </View>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
      )}
    </Page>
  );
}
