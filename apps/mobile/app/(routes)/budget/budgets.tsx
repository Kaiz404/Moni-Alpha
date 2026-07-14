import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { BrandHeader } from '@/components/ui/brand-header';
import { ScreenShell } from '@/components/ui/screen-shell';
import { PrimaryButton } from '@/components/ui/primary-button';
import { getExpenseCategoriesForBudgets } from '@/lib/supabase/categories';
import {
  deleteCategoryBudget,
  getCategoryBudgets,
  upsertCategoryBudget,
} from '@/lib/supabase/category-budgets';

type CatRow = { id: string; name: string; color: string | null };

export default function BudgetsScreen() {
  const insets = useSafeAreaInsets();
  const tokens = useThemeTokens();
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<CatRow[]>([]);
  const [amountDraft, setAmountDraft] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [catRows, budgets] = await Promise.all([
        getExpenseCategoriesForBudgets(),
        getCategoryBudgets(),
      ]);

      setCategories(
        catRows.map((c) => ({
          id: c.id,
          name: c.name,
          color: c.color,
        })),
      );

      const draft: Record<string, string> = {};
      for (const b of budgets) {
        draft[b.categoryId] = String(b.amount);
      }
      for (const c of catRows) {
        if (draft[c.id] === undefined) draft[c.id] = '';
      }
      setAmountDraft(draft);
    } catch (e) {
      console.error('[BudgetsScreen] load failed', e);
      Alert.alert(
        'Could not load',
        e instanceof Error ? e.message : 'Check sync and try again.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load().catch(() => {});
  }, [load]);

  const saveBudget = async (categoryId: string) => {
    const raw = (amountDraft[categoryId] ?? '').trim();
    if (raw === '') {
      setSavingId(categoryId);
      try {
        await deleteCategoryBudget(categoryId);
        await load();
      } catch (e) {
        Alert.alert('Could not clear budget', e instanceof Error ? e.message : 'Unknown error');
      } finally {
        setSavingId(null);
      }
      return;
    }

    const n = parseFloat(raw.replace(/,/g, ''));
    if (Number.isNaN(n) || n <= 0) {
      Alert.alert('Invalid amount', 'Enter a positive number or leave empty to remove the budget.');
      return;
    }

    setSavingId(categoryId);
    try {
      await upsertCategoryBudget(categoryId, n);
      await load();
    } catch (e) {
      Alert.alert('Could not save', e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setSavingId(null);
    }
  };

  return (
    <ScreenShell>
      <BrandHeader title="Category budgets" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1"
        keyboardVerticalOffset={0}>
        {loading ? (
          <View className="flex-1 items-center justify-center bg-background">
            <ActivityIndicator size="large" color={tokens.primary} />
          </View>
        ) : (
          <ScrollView
            className="flex-1 bg-background"
            contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
            keyboardShouldPersistTaps="handled">
            <View className="px-4 pt-4">
              <Text className="mb-4 text-sm leading-5 text-muted">
                Monthly limits apply to <Text className="font-bold text-foreground">all wallets</Text> combined. The
                budget coach compares this month&apos;s expenses (by category) to these caps.
              </Text>

              {categories.length === 0 ? (
                <Text className="py-8 text-center text-[15px] text-muted">
                  No expense categories available.
                </Text>
              ) : (
                categories.map((c) => (
                  <View
                    key={c.id}
                    className="mb-3 rounded-2xl border border-border bg-card p-3">
                    <Text className="text-base font-semibold text-foreground">
                      {c.name}
                    </Text>
                    <View className="mt-2 flex-row items-center gap-2">
                      <TextInput
                        className="flex-1 rounded-lg border border-border bg-background px-3 py-2.5 text-base text-foreground"
                        placeholder="Monthly budget (empty = none)"
                        placeholderTextColor="#94a3b8"
                        keyboardType="decimal-pad"
                        value={amountDraft[c.id] ?? ''}
                        onChangeText={(t) => setAmountDraft((prev) => ({ ...prev, [c.id]: t }))}
                      />
                      {savingId === c.id ? (
                        <View className="min-w-[88px] items-center justify-center rounded-lg bg-primary px-4 py-3">
                          <ActivityIndicator color="#ffffff" />
                        </View>
                      ) : (
                        <PrimaryButton
                          label="Save"
                          className="min-w-[88px] px-4 py-3"
                          onPress={() => saveBudget(c.id)}
                        />
                      )}
                    </View>
                  </View>
                ))
              )}
            </View>
          </ScrollView>
        )}
      </KeyboardAvoidingView>
    </ScreenShell>
  );
}
