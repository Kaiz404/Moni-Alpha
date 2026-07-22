import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { useValue } from '@legendapp/state/react';

import { BudgetProgressItem } from '@/components/budgets/budget-progress-item';
import { BrandHeader } from '@/components/ui/brand-header';
import { FeedbackState } from '@/components/ui/feedback-state';
import { IconAction } from '@/components/ui/icon-action';
import { ScreenShell } from '@/components/ui/screen-shell';
import { Surface } from '@/components/ui/surface';
import { useAuth } from '@/lib/auth/auth-context';
import { budgetProgress$ } from '@/lib/finance/selectors';
import { ensureFinanceTimezone } from '@/lib/supabase/profile';

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
    <ScreenShell variant="canvas">
      <BrandHeader
        title="Monthly Budgets"
        rightAction={
          <IconAction
            accessibilityLabel="Add budget"
            icon="plus"
            tone="accent"
            onPress={() => router.push('/budget/form' as never)}
          />
        }
      />
      {!budgets.length ? (
        <View className="flex-1 items-center justify-center px-5">
          <FeedbackState
            icon="piggy-bank"
            title="No budgets yet"
            description="Add a monthly cap for the category you want to keep in view."
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
                  <Surface>
                    <BudgetProgressItem
                      budget={row}
                      variant="detailed"
                      showArchived
                    />
                  </Surface>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
      )}
    </ScreenShell>
  );
}
