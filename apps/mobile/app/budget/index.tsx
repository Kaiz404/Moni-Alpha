import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BrandHeader } from "@/components/ui/brand-header";
import { PrimaryButton } from "@/components/ui/primary-button";
import { ScreenShell } from "@/components/ui/screen-shell";
import { useThemeTokens } from "@/hooks/use-theme-tokens";
import {
  buildBudgetProgress,
  type BudgetProgress,
} from "@/lib/budgets/metrics";
import {
  getCategoryBudgets,
  deleteCategoryBudget,
  upsertCategoryBudget,
} from "@/lib/supabase/category-budgets";
import { getExpenseCategoriesForBudgets } from "@/lib/supabase/categories";
import { ensureFinanceTimezone } from "@/lib/supabase/profile";
import { getTransactions } from "@/lib/supabase/transactions";
import { getWallets } from "@/lib/supabase/wallets";
import type { CategoryBudget } from "@repo/types";

type Category = { id: string; name: string; color: string | null };

const money = (currency: string, amount: number) =>
  `${currency} ${amount.toFixed(2)}`;
const keyFor = (categoryId: string, currency: string) =>
  `${categoryId}:${currency}`;

export default function BudgetsScreen() {
  const insets = useSafeAreaInsets();
  const tokens = useThemeTokens();
  const [loading, setLoading] = useState(true);
  const [managing, setManaging] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [budgets, setBudgets] = useState<CategoryBudget[]>([]);
  const [progress, setProgress] = useState<BudgetProgress[]>([]);
  const [currencies, setCurrencies] = useState<string[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [categoryRows, budgetRows, transactions, wallets, timezone] =
        await Promise.all([
          getExpenseCategoriesForBudgets(),
          getCategoryBudgets(),
          getTransactions(undefined, 8000),
          getWallets(),
          ensureFinanceTimezone(),
        ]);
      const allCurrencies = [
        ...new Set([
          ...wallets.map((wallet) => (wallet.currency ?? "USD").toUpperCase()),
          ...budgetRows.map((budget) => budget.currency),
        ]),
      ].sort();
      setCategories(categoryRows);
      setBudgets(budgetRows);
      setCurrencies(allCurrencies);
      setProgress(
        buildBudgetProgress(categoryRows, budgetRows, transactions, timezone),
      );
      setDrafts(
        Object.fromEntries(
          budgetRows.map((budget) => [
            keyFor(budget.categoryId, budget.currency),
            String(budget.amount),
          ]),
        ),
      );
    } catch (error) {
      Alert.alert(
        "Could not load budgets",
        error instanceof Error
          ? error.message
          : "Try again after sync completes.",
      );
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    load().catch(() => {});
  }, [load]);

  const grouped = useMemo(
    () =>
      Object.entries(
        progress.reduce<Record<string, BudgetProgress[]>>((groups, item) => {
          (groups[item.currency] ??= []).push(item);
          return groups;
        }, {}),
      ).sort(([a], [b]) => a.localeCompare(b)),
    [progress],
  );

  const save = async (categoryId: string, currency: string) => {
    const id = keyFor(categoryId, currency);
    const raw = (drafts[id] ?? "").trim();
    setSaving(id);
    try {
      if (!raw) await deleteCategoryBudget(categoryId, currency);
      else {
        const amount = Number(raw.replace(/,/g, ""));
        if (!Number.isFinite(amount) || amount <= 0)
          throw new Error(
            "Enter a positive amount or leave it blank to remove the cap.",
          );
        await upsertCategoryBudget(categoryId, currency, amount);
      }
      await load();
    } catch (error) {
      Alert.alert(
        "Could not save budget",
        error instanceof Error ? error.message : "Unknown error",
      );
    } finally {
      setSaving(null);
    }
  };

  return (
    <ScreenShell>
      <BrandHeader title="Budgets" />
      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={tokens.primary} />
        </View>
      ) : (
        <ScrollView
          className="flex-1 bg-background"
          contentContainerStyle={{ paddingBottom: insets.bottom + 28 }}
        >
          <View className="px-4 pt-4">
            <View className="mb-4 flex-row items-center justify-between">
              <View>
                <Text className="text-xl font-bold text-foreground">
                  This month
                </Text>
                <Text className="mt-1 text-sm text-muted">
                  Only categorized spending counts. Debt and transfers are
                  excluded.
                </Text>
              </View>
              <Pressable
                className="rounded-lg border border-border px-3 py-2"
                onPress={() => setManaging((value) => !value)}
              >
                <Text className="font-semibold text-primary">
                  {managing ? "Done" : "Manage"}
                </Text>
              </Pressable>
            </View>
            {managing ? (
              <>
                {currencies.length === 0 ? (
                  <Text className="py-8 text-center text-muted">
                    Add a wallet before setting a budget.
                  </Text>
                ) : (
                  currencies.map((currency) => (
                    <View key={currency} className="mb-5">
                      <Text className="mb-2 text-base font-bold text-foreground">
                        {currency} monthly caps
                      </Text>
                      {categories.map((category) => {
                        const id = keyFor(category.id, currency);
                        return (
                          <View
                            key={id}
                            className="mb-2 rounded-xl border border-border bg-card p-3"
                          >
                            <Text className="font-semibold text-foreground">
                              {category.name}
                            </Text>
                            <View className="mt-2 flex-row gap-2">
                              <TextInput
                                className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-foreground"
                                keyboardType="decimal-pad"
                                placeholder="No cap"
                                placeholderTextColor={tokens.muted}
                                value={drafts[id] ?? ""}
                                onChangeText={(value) =>
                                  setDrafts((old) => ({ ...old, [id]: value }))
                                }
                              />
                              <PrimaryButton
                                label={saving === id ? "Saving…" : "Save"}
                                disabled={saving === id}
                                className="px-4"
                                onPress={() => save(category.id, currency)}
                              />
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  ))
                )}
              </>
            ) : grouped.length === 0 ? (
              <View className="rounded-2xl border border-dashed border-border p-6">
                <Text className="text-center font-semibold text-foreground">
                  No budget activity yet
                </Text>
                <Text className="mt-1 text-center text-sm text-muted">
                  Set a cap or add a categorized expense to get started.
                </Text>
              </View>
            ) : (
              grouped.map(([currency, rows]) => (
                <View key={currency} className="mb-5">
                  <Text className="mb-2 text-base font-bold text-foreground">
                    {currency}
                  </Text>
                  {rows.map((row) => (
                    <Pressable
                      key={`${row.categoryId}:${currency}`}
                      onPress={() =>
                        router.push({
                          pathname: "/transaction",
                          params: {
                            categoryId: row.categoryId,
                            currency,
                            month: new Date().toISOString().slice(0, 7),
                          },
                        } as any)
                      }
                      className="mb-2 rounded-2xl border border-border bg-card p-3"
                    >
                      <View className="flex-row justify-between">
                        <Text className="font-semibold text-foreground">
                          {row.categoryName}
                        </Text>
                        <Text
                          className={
                            row.status === "over"
                              ? "font-bold text-expense"
                              : row.status === "near_limit"
                                ? "font-bold text-warning"
                                : "font-bold text-foreground"
                          }
                        >
                          {row.budgetAmount == null
                            ? "Unbudgeted"
                            : row.percentage + "%"}
                        </Text>
                      </View>
                      <Text className="mt-1 text-sm text-muted">
                        {money(currency, row.spent)} spent
                        {row.budgetAmount == null
                          ? ""
                          : ` of ${money(currency, row.budgetAmount)}`}
                      </Text>
                      {row.remaining != null ? (
                        <Text
                          className={
                            row.remaining < 0
                              ? "mt-1 text-sm text-expense"
                              : "mt-1 text-sm text-muted"
                          }
                        >
                          {row.remaining < 0
                            ? `${money(currency, Math.abs(row.remaining))} over`
                            : `${money(currency, row.remaining)} left`}
                        </Text>
                      ) : null}
                    </Pressable>
                  ))}
                </View>
              ))
            )}
          </View>
        </ScrollView>
      )}
    </ScreenShell>
  );
}
