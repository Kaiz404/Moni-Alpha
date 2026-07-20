import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { useValue } from '@legendapp/state/react';

import { AmountInput } from '@/components/finance/amount-input';
import { BrandHeader } from '@/components/ui/brand-header';
import { FeedbackState } from '@/components/ui/feedback-state';
import { IconAction } from '@/components/ui/icon-action';
import { PrimaryButton } from '@/components/ui/primary-button';
import { ScreenShell } from '@/components/ui/screen-shell';
import { Surface } from '@/components/ui/surface';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { useAuth } from '@/lib/auth/auth-context';
import {
  formatMinorAmount,
  minorToDecimal,
  parseAmountInput,
} from '@/lib/finance/money';
import {
  budgetProgress$,
  expenseCategories$,
  walletsForUser$,
} from '@/lib/finance/selectors';
import {
  deleteCategoryBudget,
  upsertCategoryBudget,
} from '@/lib/supabase/category-budgets';
import { ensureFinanceTimezone } from '@/lib/supabase/profile';

const keyFor = (categoryId: string, currency: string) =>
  `${categoryId}:${currency}`;

const statusCopy = {
  on_track: 'On track',
  near_limit: 'Getting close',
  over: 'Over budget',
  unbudgeted: 'No budget',
} as const;

const statusBarClass = {
  on_track: 'bg-primary',
  near_limit: 'bg-warning',
  over: 'bg-danger',
  unbudgeted: 'bg-border-strong',
} as const;

export default function BudgetsScreen() {
  const { user } = useAuth();
  const tokens = useThemeTokens();
  const [timezone, setTimezone] = useState('UTC');
  const [managing, setManaging] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const categories = useValue(expenseCategories$(user?.id ?? null));
  const wallets = useValue(walletsForUser$(user?.id ?? null));
  const progress = useValue(
    budgetProgress$(user?.id ?? null, timezone),
  );

  useEffect(() => {
    void ensureFinanceTimezone()
      .then(setTimezone)
      .catch(() => {});
  }, []);

  useEffect(() => {
    setDrafts((current) => {
      const next = { ...current };
      for (const row of progress) {
        const key = keyFor(row.categoryId, row.currency);
        if (
          row.budgetAmountMinor !== null &&
          next[key] === undefined
        ) {
          next[key] = minorToDecimal(row.budgetAmountMinor);
        }
      }
      return next;
    });
  }, [progress]);

  const currencies = useMemo(
    () =>
      [
        ...new Set([
          ...wallets.map((wallet) => wallet.currency),
          ...progress.map((row) => row.currency),
        ]),
      ].sort(),
    [progress, wallets],
  );
  const grouped = useMemo(
    () =>
      Object.entries(
        progress.reduce<Record<string, typeof progress>>(
          (all, row) => {
            (all[row.currency] ??= []).push(row);
            return all;
          },
          {},
        ),
      ).sort(([a], [b]) => a.localeCompare(b)),
    [progress],
  );

  const save = async (categoryId: string, currency: string) => {
    const id = keyFor(categoryId, currency);
    setSaving(id);
    try {
      const amount = (drafts[id] ?? '').trim();
      if (!amount) await deleteCategoryBudget(categoryId, currency);
      else
        await upsertCategoryBudget(
          categoryId,
          currency,
          parseAmountInput(amount),
        );
    } catch (error) {
      Alert.alert(
        'Could not save budget',
        error instanceof Error ? error.message : 'Please try again.',
      );
    } finally {
      setSaving(null);
    }
  };

  return (
    <ScreenShell variant="canvas">
      <BrandHeader title="Budgets" />
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-5 pb-10 pt-6"
        showsVerticalScrollIndicator={false}
      >
        <View className="flex-row items-start justify-between gap-4">
          <View className="flex-1">
            <Text className="text-2xl font-bold text-foreground">
              This month
            </Text>
            <Text className="mt-2 text-[15px] leading-5 text-muted">
              Spending is kept separate by currency. Debt activity and
              wallet transfers do not count here.
            </Text>
          </View>
          <IconAction
            accessibilityLabel={
              managing ? 'Finish managing budgets' : 'Manage budgets'
            }
            icon={managing ? 'check' : 'tune'}
            tone="accent"
            onPress={() => setManaging((current) => !current)}
          />
        </View>

        {managing ? (
          <View className="mt-7">
            <Text className="text-base font-bold text-foreground">
              Set monthly caps
            </Text>
            <Text className="mt-1 text-sm leading-5 text-muted">
              Leave a cap empty to remove it. A cap applies only to
              the shown currency.
            </Text>
            {currencies.length === 0 ? (
              <FeedbackState
                description="Add a wallet before setting a category cap."
                icon="wallet"
                title="No currency available"
              />
            ) : (
              currencies.map((currency) => (
                <View
                  key={currency}
                  className="mt-6"
                >
                  <Text className="mb-3 text-base font-bold text-foreground">
                    {currency} caps
                  </Text>
                  {categories.map((category) => {
                    const id = keyFor(category.id, currency);
                    return (
                      <Surface
                        key={id}
                        className="mb-3 p-4"
                      >
                        <View className="flex-row items-center justify-between gap-3">
                          <Text className="flex-1 text-[15px] font-semibold text-foreground">
                            {category.icon} {category.name}
                          </Text>
                          <PrimaryButton
                            className="min-h-11 px-4 py-2"
                            disabled={saving === id}
                            label={saving === id ? 'Saving…' : 'Save'}
                            variant="quiet"
                            onPress={() =>
                              save(category.id, currency)
                            }
                          />
                        </View>
                        <AmountInput
                          className="mt-3 min-h-13 rounded-2xl border border-border bg-surface-2 px-4 py-3 text-right text-lg font-semibold text-foreground"
                          currency={currency}
                          onChangeValue={(value) =>
                            setDrafts((current) => ({
                              ...current,
                              [id]: value,
                            }))
                          }
                          placeholder="No cap"
                          placeholderTextColor={tokens.muted}
                          value={drafts[id] ?? ''}
                        />
                      </Surface>
                    );
                  })}
                </View>
              ))
            )}
          </View>
        ) : grouped.length === 0 ? (
          <FeedbackState
            className="mt-10"
            description="Set a cap or add a categorized expense to see its progress."
            icon="piggy-bank"
            title="No budget activity yet"
          />
        ) : (
          grouped.map(([currency, rows]) => (
            <View
              key={currency}
              className="mt-8"
            >
              <Text className="mb-3 text-lg font-bold text-foreground">
                {currency}
              </Text>
              {rows.map((row) => {
                const percentage = row.percentage ?? 0;
                const clampedPercentage = Math.min(
                  Math.max(percentage, 0),
                  100,
                );
                const isOver = row.status === 'over';
                const remaining = row.remainingMinor;
                return (
                  <Pressable
                    key={keyFor(row.categoryId, currency)}
                    accessibilityRole="button"
                    className="mb-3"
                    onPress={() =>
                      router.push({
                        pathname: '/transaction',
                        params: {
                          categoryId: row.categoryId,
                          currency,
                          month: new Date().toISOString().slice(0, 7),
                        },
                      } as never)
                    }
                  >
                    <Surface className="p-4">
                      <View className="flex-row items-start justify-between gap-3">
                        <View className="min-w-0 flex-1 flex-row items-center gap-3">
                          <View className="h-10 w-10 items-center justify-center rounded-full bg-primary-muted">
                            <Text className="text-lg">
                              {row.categoryIcon ?? '•'}
                            </Text>
                          </View>
                          <View className="min-w-0 flex-1">
                            <Text
                              className="text-[15px] font-semibold text-foreground"
                              numberOfLines={1}
                            >
                              {row.categoryName}
                            </Text>
                            <Text className="mt-1 text-sm text-muted">
                              {statusCopy[row.status]}
                            </Text>
                          </View>
                        </View>
                        <Text className="text-right text-sm font-bold text-foreground">
                          {row.budgetAmountMinor === null
                            ? 'No cap'
                            : `${percentage}%`}
                        </Text>
                      </View>
                      <View className="mt-4 h-2 overflow-hidden rounded-full bg-surface-2">
                        <View
                          className={`h-full rounded-full ${statusBarClass[row.status]}`}
                          style={{
                            width: `${row.budgetAmountMinor === null ? 18 : clampedPercentage}%`,
                          }}
                        />
                      </View>
                      <View className="mt-3 flex-row justify-between gap-3">
                        <Text className="flex-1 text-sm text-muted">
                          {formatMinorAmount(
                            row.spentMinor,
                            currency,
                          )}{' '}
                          spent
                          {row.budgetAmountMinor === null
                            ? ''
                            : ` of ${formatMinorAmount(row.budgetAmountMinor, currency)}`}
                        </Text>
                        {remaining !== null ? (
                          <Text
                            className={`text-right text-sm font-semibold ${isOver ? 'text-danger' : 'text-muted'}`}
                          >
                            {isOver
                              ? `${formatMinorAmount(-Number(remaining), currency)} over`
                              : `${formatMinorAmount(remaining, currency)} left`}
                          </Text>
                        ) : null}
                      </View>
                    </Surface>
                  </Pressable>
                );
              })}
            </View>
          ))
        )}
      </ScrollView>
    </ScreenShell>
  );
}
