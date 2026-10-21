import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, View } from 'react-native';
import { Text } from '@/components/ui/text';
import { router, useLocalSearchParams } from 'expo-router';
import { useValue } from '@legendapp/state/react';

import { CategoryIcon } from '@/components/categories/category-icon';
import { ProgressBar } from '@/components/ui/progress-bar';
import { AmountInput } from '@/components/finance/amount-input';
import { PickerField } from '@/components/ui/picker-field';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { useAuth } from '@/lib/auth/auth-context';
import {
  minorToDecimal,
  parseAmountInput,
} from '@/lib/finance/money';
import {
  budgetProgress$,
  expenseCategories$,
  recentExpenseCategories$,
  walletsForUser$,
} from '@/lib/finance/selectors';
import {
  deleteCategoryBudget,
  upsertCategoryBudget,
} from '@/lib/supabase/category-budgets';
import { ensureFinanceTimezone } from '@/lib/supabase/profile';
import { toCategoryTiles } from '@/lib/sheet/category-tiles';
import { openSheet } from '@/lib/sheet/sheet-store';
import { HeaderIconButton } from '@/components/ui/header-icon-button';
import { tid } from '@/lib/test-ids';
import { Button } from '@/components/ui/button';
import { Page } from '@/components/ui/page';

export default function BudgetFormScreen() {
  const params = useLocalSearchParams<{
    categoryId?: string;
    currency?: string;
  }>();
  const { user } = useAuth();
  const tokens = useThemeTokens();
  const [timezone, setTimezone] = useState('UTC');
  const [categoryId, setCategoryId] = useState(
    params.categoryId ?? '',
  );
  const [currency, setCurrency] = useState(
    params.currency?.toUpperCase() ?? 'USD',
  );
  const [amount, setAmount] = useState('');
  const [saving, setSaving] = useState(false);
  const categories = useValue(expenseCategories$(user?.id ?? null));
  const suggested = useValue(
    recentExpenseCategories$(user?.id ?? null),
  );
  const wallets = useValue(walletsForUser$(user?.id ?? null));
  const progress = useValue(
    budgetProgress$(user?.id ?? null, timezone),
  );
  const selected =
    categories.find((category) => category.id === categoryId) ?? null;
  const currencies = useMemo(
    () =>
      [...new Set(wallets.map((wallet) => wallet.currency))].sort(),
    [wallets],
  );
  const existing =
    progress.find(
      (row) =>
        row.categoryId === categoryId &&
        row.currency === currency &&
        row.budgetAmountMinor !== null,
    ) ?? null;

  useEffect(() => {
    void ensureFinanceTimezone()
      .then(setTimezone)
      .catch(() => {});
  }, []);
  useEffect(() => {
    if (!params.categoryId) return;
    setCategoryId(params.categoryId);
  }, [params.categoryId]);
  useEffect(() => {
    if (params.currency) setCurrency(params.currency.toUpperCase());
  }, [params.currency]);
  const existingAmount = existing?.budgetAmountMinor;
  useEffect(() => {
    if (existingAmount) setAmount(minorToDecimal(existingAmount));
  }, [existingAmount]);
  useEffect(() => {
    if (!currency && currencies[0]) setCurrency(currencies[0]);
  }, [currencies, currency]);

  const pickCategory = async () => {
    const picked = await openSheet({
      kind: 'category',
      title: 'Choose category',
      currency,
      categories: toCategoryTiles(
        categories,
        progress,
        currency,
        suggested.map((category) => category.id),
      ),
      selectedId: categoryId || null,
      onCreate: () =>
        router.push({
          pathname: '/categories/form',
          params: { type: 'expense', returnTo: '/budget/form' },
        } as never),
    });
    if (picked) setCategoryId(picked);
  };

  const pickCurrency = async () => {
    const picked = await openSheet({
      kind: 'currency',
      selected: currency,
    });
    if (picked) setCurrency(picked);
  };

  const save = async () => {
    if (!selected) {
      void pickCategory();
      return;
    }
    try {
      const parsed = parseAmountInput(amount);
      setSaving(true);
      await upsertCategoryBudget(selected.id, currency, parsed);
      router.back();
    } catch (error) {
      Alert.alert(
        'Check this budget',
        error instanceof Error
          ? error.message
          : 'Enter a positive monthly cap.',
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = useCallback(async () => {
    if (!existing || !selected) return;
    const confirmed = await openSheet({
      kind: 'confirm',
      title: 'Delete this budget?',
      message: `${selected.name} loses its monthly cap. You can set it again any time.`,
      confirmLabel: 'Delete',
      cancelLabel: 'Keep it',
      destructive: true,
    });
    if (!confirmed) return;
    try {
      await deleteCategoryBudget(selected.id, currency);
      router.back();
    } catch (error) {
      Alert.alert(
        'Could not delete budget',
        error instanceof Error ? error.message : 'Please try again.',
      );
    }
  }, [currency, existing, selected]);

  return (
    <Page
      screen="budget"
      kind="pushed"
      title={existing ? 'Edit budget' : 'New budget'}
      trailing={
        existing ? (
          <HeaderIconButton
            testID={tid('budget', 'delete-budget')}
            accessibilityLabel="Delete budget"
            icon="trash-can-outline"
            onPress={() => void handleDelete()}
          />
        ) : null
      }
    >
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-5"
        showsVerticalScrollIndicator={false}
      >
        {existing?.budgetAmountMinor != null ? (
          <View className="mt-7 rounded-card bg-card p-card">
            <ProgressBar
              title="This month"
              spentMinor={existing.spentMinor}
              budgetMinor={existing.budgetAmountMinor}
              currency={currency}
            />
          </View>
        ) : null}
        <PickerField
          testID={tid('budget', 'category')}
          className="mt-7"
          label="Category"
          value={selected?.name ?? ''}
          leading={
            selected ? (
              <View
                className="h-8 w-8 items-center justify-center rounded-full bg-sand"
                style={
                  selected.color
                    ? { backgroundColor: selected.color }
                    : undefined
                }
              >
                <CategoryIcon
                  color={tokens.onPastel}
                  icon={selected.icon}
                  size={18}
                />
              </View>
            ) : undefined
          }
          onPress={() => void pickCategory()}
        />
        <Text className="mb-2 mt-7 text-sm font-display-semibold text-foreground">
          Monthly cap
        </Text>
        <AmountInput
          className="min-h-14 rounded-2xl px-4 text-right text-xl font-display-bold text-foreground"
          currency={currency}
          onCurrencyPress={() => void pickCurrency()}
          value={amount}
          onChangeValue={setAmount}
          placeholder="0.00"
          placeholderTextColor={tokens.muted}
        />
        <Button
          testID={tid('budget', 'save-changes')}
          className="mt-8"
          icon="check"
          label={existing ? 'Save changes' : 'Create budget'}
          loading={saving}
          loadingLabel="Saving budget…"
          onPress={() => void save()}
        />
      </ScrollView>
    </Page>
  );
}
