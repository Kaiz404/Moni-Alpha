import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useValue } from '@legendapp/state/react';
import { AmountInput } from '@/components/finance/amount-input';
import { FinanceState } from '@/components/finance/finance-state';
import { BrandHeader } from '@/components/ui/brand-header';
import { PrimaryButton } from '@/components/ui/primary-button';
import { ScreenShell } from '@/components/ui/screen-shell';
import { useAuth } from '@/lib/auth/auth-context';
import { formatMinorAmount, minorToDecimal, parseAmountInput } from '@/lib/finance/money';
import { budgetProgress$, expenseCategories$, walletsForUser$ } from '@/lib/finance/selectors';
import { deleteCategoryBudget, upsertCategoryBudget } from '@/lib/supabase/category-budgets';
import { ensureFinanceTimezone } from '@/lib/supabase/profile';

const keyFor = (categoryId: string, currency: string) => `${categoryId}:${currency}`;

export default function BudgetsScreen() {
  const { user } = useAuth();
  const [timezone, setTimezone] = useState('UTC');
  const [managing, setManaging] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const categories = useValue(expenseCategories$(user?.id ?? null));
  const wallets = useValue(walletsForUser$(user?.id ?? null));
  const progress = useValue(budgetProgress$(user?.id ?? null, timezone));

  useEffect(() => {
    void ensureFinanceTimezone().then(setTimezone).catch(() => {});
  }, []);

  useEffect(() => {
    setDrafts((current) => {
      const next = { ...current };
      for (const row of progress) {
        const key = keyFor(row.categoryId, row.currency);
        if (row.budgetAmountMinor !== null && next[key] === undefined) {
          next[key] = minorToDecimal(row.budgetAmountMinor);
        }
      }
      return next;
    });
  }, [progress]);

  const currencies = useMemo(
    () => [...new Set([...wallets.map((wallet) => wallet.currency), ...progress.map((row) => row.currency)])].sort(),
    [progress, wallets],
  );
  const grouped = useMemo(
    () => Object.entries(progress.reduce<Record<string, typeof progress>>((all, row) => {
      (all[row.currency] ??= []).push(row);
      return all;
    }, {})).sort(([a], [b]) => a.localeCompare(b)),
    [progress],
  );

  const save = async (categoryId: string, currency: string) => {
    const id = keyFor(categoryId, currency);
    setSaving(id);
    try {
      const raw = (drafts[id] ?? '').trim();
      if (!raw) await deleteCategoryBudget(categoryId, currency);
      else await upsertCategoryBudget(categoryId, currency, parseAmountInput(raw));
    } catch (error) {
      Alert.alert('Could not save budget', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setSaving(null);
    }
  };

  return (
    <ScreenShell>
      <BrandHeader title="Budgets" />
      <ScrollView className="flex-1 bg-background" contentContainerClassName="p-4">
        <View className="mb-4 flex-row items-center justify-between">
          <View>
            <Text className="text-xl font-bold text-foreground">This month</Text>
            <Text className="mt-1 text-sm text-muted">Only categorized spending counts. Debt and transfers are excluded.</Text>
          </View>
          <Pressable className="rounded-lg border border-border px-3 py-2" onPress={() => setManaging((value) => !value)}>
            <Text className="font-semibold text-primary">{managing ? 'Done' : 'Manage'}</Text>
          </Pressable>
        </View>

        {managing ? (
          currencies.length === 0 ? <Text className="py-8 text-center text-muted">Add a wallet before setting a cap.</Text> : currencies.map((currency) => (
            <View key={currency} className="mb-5">
              <Text className="mb-2 text-base font-bold text-foreground">{currency} monthly caps</Text>
              {categories.map((category) => {
                const id = keyFor(category.id, currency);
                return (
                  <View key={id} className="mb-2 rounded-xl border border-border bg-card p-3">
                    <Text className="font-semibold text-foreground">{category.name}</Text>
                    <View className="mt-2 flex-row gap-2">
                      <AmountInput
                        className="rounded-lg border border-border bg-background px-3 py-2 text-foreground"
                        placeholder="No cap"
                        value={drafts[id] ?? ''}
                        onChangeValue={(value) => setDrafts((old) => ({ ...old, [id]: value }))}
                        currency={currency}
                      />
                      <PrimaryButton label={saving === id ? 'Saving…' : 'Save'} disabled={saving === id} className="px-4" onPress={() => save(category.id, currency)} />
                    </View>
                  </View>
                );
              })}
            </View>
          ))
        ) : grouped.length === 0 ? (
          <FinanceState title="No budget activity yet" detail="Set a cap or add a categorized expense to get started." />
        ) : grouped.map(([currency, rows]) => (
          <View key={currency} className="mb-5">
            <Text className="mb-2 text-base font-bold text-foreground">{currency}</Text>
            {rows.map((row) => (
              <Pressable key={keyFor(row.categoryId, currency)} onPress={() => router.push({ pathname: '/transaction', params: { categoryId: row.categoryId, currency, month: new Date().toISOString().slice(0, 7) } } as any)} className="mb-2 rounded-2xl border border-border bg-card p-3">
                <View className="flex-row justify-between">
                  <Text className="font-semibold text-foreground">{row.categoryName}</Text>
                  <Text className={row.status === 'over' ? 'font-bold text-expense' : row.status === 'near_limit' ? 'font-bold text-warning' : 'font-bold text-foreground'}>{row.budgetAmountMinor === null ? 'Unbudgeted' : `${row.percentage}%`}</Text>
                </View>
                <Text className="mt-1 text-sm text-muted">{formatMinorAmount(row.spentMinor, currency)} spent{row.budgetAmountMinor === null ? '' : ` of ${formatMinorAmount(row.budgetAmountMinor, currency)}`}</Text>
                {row.remainingMinor !== null ? <Text className={row.remainingMinor < 0 ? 'mt-1 text-sm text-expense' : 'mt-1 text-sm text-muted'}>{row.remainingMinor < 0 ? `${formatMinorAmount(-Number(row.remainingMinor), currency)} over` : `${formatMinorAmount(row.remainingMinor, currency)} left`}</Text> : null}
              </Pressable>
            ))}
          </View>
        ))}
      </ScrollView>
    </ScreenShell>
  );
}
