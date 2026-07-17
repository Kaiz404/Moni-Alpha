import { useCallback, useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useFocusEffect, router } from "expo-router";
import { BrandHeader } from "@/components/ui/brand-header";
import { PrimaryButton } from "@/components/ui/primary-button";
import { ScreenShell } from "@/components/ui/screen-shell";
import {
  debtDueState,
  getDebtActivities,
  getDebts,
  outstandingDebtBalance,
} from "@/lib/supabase/debts";
import { ensureFinanceTimezone } from "@/lib/supabase/profile";
import type { Debt, DebtActivity } from "@repo/types";

const money = (currency: string, amount: number) =>
  `${currency} ${amount.toFixed(2)}`;
export default function DebtsScreen() {
  const [debts, setDebts] = useState<Debt[]>([]);
  const [activities, setActivities] = useState<DebtActivity[]>([]);
  const [timezone, setTimezone] = useState("UTC");
  const [tab, setTab] = useState<"owed_to_me" | "i_owe">("owed_to_me");
  const load = useCallback(async () => {
    const [items, events, tz] = await Promise.all([
      getDebts(),
      getDebtActivities(),
      ensureFinanceTimezone(),
    ]);
    setDebts(items);
    setActivities(events);
    setTimezone(tz);
  }, []);
  useFocusEffect(
    useCallback(() => {
      load().catch(() => {});
    }, [load]),
  );
  const shown = useMemo(
    () =>
      debts
        .filter((debt) => debt.direction === tab)
        .map((debt) => ({
          debt,
          balance: outstandingDebtBalance(
            activities.filter((event) => event.debtId === debt.id),
          ),
        })),
    [debts, activities, tab],
  );
  const totals = useMemo(
    () =>
      Object.entries(
        shown.reduce<Record<string, number>>((all, item) => {
          all[item.debt.currency] =
            (all[item.debt.currency] ?? 0) + item.balance;
          return all;
        }, {}),
      ),
    [shown],
  );
  return (
    <ScreenShell>
      <BrandHeader title="Debts" />
      <ScrollView
        className="flex-1 bg-background"
        contentContainerClassName="p-4"
      >
        <View className="mb-4 flex-row gap-2">
          {(["owed_to_me", "i_owe"] as const).map((value) => (
            <Pressable
              key={value}
              className={`flex-1 rounded-xl px-3 py-2.5 ${tab === value ? "bg-primary" : "border border-border bg-card"}`}
              onPress={() => setTab(value)}
            >
              <Text
                className={`text-center font-semibold ${tab === value ? "text-white" : "text-foreground"}`}
              >
                {value === "owed_to_me" ? "Owed to me" : "I owe"}
              </Text>
            </Pressable>
          ))}
        </View>
        {totals.map(([currency, amount]) => (
          <Text
            key={currency}
            className="mb-2 text-lg font-bold text-foreground"
          >
            {money(currency, amount)} outstanding
          </Text>
        ))}
        {shown.length === 0 ? (
          <View className="mt-12 items-center">
            <Text className="text-lg font-bold text-foreground">
              No debts here
            </Text>
            <Text className="mt-1 text-center text-muted">
              Track money you lend or borrow without affecting your spending
              categories.
            </Text>
          </View>
        ) : (
          shown.map(({ debt, balance }) => {
            const state = debtDueState(debt, balance, new Date(), timezone);
            return (
              <Pressable
                key={debt.id}
                className="mb-2 rounded-2xl border border-border bg-card p-4"
                onPress={() => router.push(`/debt/${debt.id}` as any)}
              >
                <View className="flex-row justify-between">
                  <Text className="text-base font-bold text-foreground">
                    {debt.counterpartyName}
                  </Text>
                  <Text className="font-bold text-foreground">
                    {money(debt.currency, balance)}
                  </Text>
                </View>
                <Text className="mt-1 text-sm text-muted">
                  {state === "due_soon"
                    ? "Due soon"
                    : state === "overdue"
                      ? "Overdue"
                      : state.replace("_", " ")}
                </Text>
                {debt.dueDate ? (
                  <Text className="mt-1 text-xs text-muted">
                    Due {debt.dueDate}
                  </Text>
                ) : null}
              </Pressable>
            );
          })
        )}
        <View className="mt-4">
          <PrimaryButton
            label="Record debt"
            icon="add"
            onPress={() => router.push("/debt/new" as any)}
          />
        </View>
      </ScrollView>
    </ScreenShell>
  );
}
