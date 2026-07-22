import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useValue } from '@legendapp/state/react';

import { CategoryIcon } from '@/components/categories/category-icon';
import { CategoryPickerModal } from '@/components/categories/category-picker-modal';
import { AmountInput } from '@/components/finance/amount-input';
import { CurrencyPickerModal } from '@/components/finance/currency-picker-modal';
import { BrandHeader } from '@/components/ui/brand-header';
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
  recentExpenseCategories$,
  walletsForUser$,
} from '@/lib/finance/selectors';
import {
  deleteCategoryBudget,
  upsertCategoryBudget,
} from '@/lib/supabase/category-budgets';
import { ensureFinanceTimezone } from '@/lib/supabase/profile';

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
  const [pickerVisible, setPickerVisible] = useState(false);
  const [currencyPickerVisible, setCurrencyPickerVisible] =
    useState(false);
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

  const save = async () => {
    if (!selected) {
      setPickerVisible(true);
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

  const handleDelete = useCallback(() => {
    if (!existing || !selected) return;
    Alert.alert(
      'Delete budget?',
      'This removes the monthly cap for this category. You can set it again any time.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete budget',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteCategoryBudget(selected.id, currency);
              router.back();
            } catch (error) {
              Alert.alert(
                'Could not delete budget',
                error instanceof Error
                  ? error.message
                  : 'Please try again.',
              );
            }
          },
        },
      ],
    );
  }, [currency, existing, selected]);

  return (
    <ScreenShell variant="canvas">
      <BrandHeader
        title={existing ? 'Edit budget' : 'New budget'}
        rightAction={
          existing ? (
            <IconAction
              accessibilityLabel="Delete budget"
              icon="trash-can-outline"
              onPress={handleDelete}
              tone="danger"
            />
          ) : null
        }
      />
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-5"
        showsVerticalScrollIndicator={false}
      >
        <Text className="mb-2 mt-7 text-sm font-semibold text-foreground">
          Category
        </Text>
        <Pressable
          className="min-h-14 flex-row items-center rounded-2xl bg-surface-2 px-4 py-3 active:opacity-85"
          onPress={() => setPickerVisible(true)}
        >
          {selected ? (
            <>
              <View
                className="mr-3 h-10 w-10 items-center justify-center rounded-full"
                style={{
                  backgroundColor: `${selected.color ?? tokens.primary}`,
                }}
              >
                <CategoryIcon
                  color={tokens.foreground}
                  icon={selected.icon}
                  size={20}
                />
              </View>
              <Text className="flex-1 text-base font-semibold text-foreground">
                {selected.name}
              </Text>
            </>
          ) : (
            <Text className="flex-1 text-base text-muted">
              Choose a category
            </Text>
          )}
          <CategoryIcon
            color={tokens.muted}
            icon="pencil-outline"
            size={22}
          />
        </Pressable>
        <Text className="mb-2 mt-7 text-sm font-semibold text-foreground">
          Monthly cap
        </Text>
        <AmountInput
          className="min-h-14 rounded-2xl px-4 text-right text-xl font-bold text-foreground"
          currency={currency}
          onCurrencyPress={() => setCurrencyPickerVisible(true)}
          value={amount}
          onChangeValue={setAmount}
          placeholder="0.00"
          placeholderTextColor={tokens.muted}
        />
        {existing ? (
          <Surface
            tone="muted"
            className="mt-7 p-4"
          >
            <Text className="text-sm font-semibold text-foreground">
              This month
            </Text>
            <Text className="mt-1 text-sm text-muted">
              {formatMinorAmount(existing.spentMinor, currency)} spent
              of{' '}
              {formatMinorAmount(
                existing.budgetAmountMinor!,
                currency,
              )}
              .
            </Text>
          </Surface>
        ) : null}
        <PrimaryButton
          className="mt-8"
          icon="check"
          label={existing ? 'Save changes' : 'Create budget'}
          loading={saving}
          loadingLabel="Saving budget…"
          onPress={() => void save()}
        />
      </ScrollView>
      <CategoryPickerModal
        visible={pickerVisible}
        categories={categories}
        suggested={suggested}
        selectedId={categoryId}
        title="Choose budget category"
        onClose={() => setPickerVisible(false)}
        onSelect={(category) => {
          setCategoryId(category.id);
        }}
        onCreate={() => {
          router.push({
            pathname: '/categories/form',
            params: { type: 'expense', returnTo: '/budget/form' },
          } as never);
        }}
      />
      <CurrencyPickerModal
        visible={currencyPickerVisible}
        selectedCode={currency}
        onClose={() => setCurrencyPickerVisible(false)}
        onSelect={(code) => {
          setCurrency(code);
        }}
      />
    </ScreenShell>
  );
}
