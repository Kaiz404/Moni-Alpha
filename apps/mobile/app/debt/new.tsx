import { useEffect, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { router } from "expo-router";
import { BrandHeader } from "@/components/ui/brand-header";
import { AmountInput } from '@/components/finance/amount-input';
import { PrimaryButton } from "@/components/ui/primary-button";
import { ScreenShell } from "@/components/ui/screen-shell";
import { useThemeTokens } from "@/hooks/use-theme-tokens";
import { createDebt } from "@/lib/supabase/debts";
import { getWallets } from "@/lib/supabase/wallets";
import type { DebtDirection } from "@repo/types";
import { parseAmountInput } from '@/lib/finance/money';

export default function NewDebtScreen() {
  const tokens = useThemeTokens();
  type WalletItem = Awaited<ReturnType<typeof getWallets>>[number];
  const [name, setName] = useState("");
  const [direction, setDirection] = useState<DebtDirection>("owed_to_me");
  const [amount, setAmount] = useState("");
  const [wallets, setWallets] = useState<WalletItem[]>([]);
  const [walletId, setWalletId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    getWallets()
      .then((items) => {
        setWallets(items);
        setWalletId(items[0]?.id ?? "");
      })
      .catch(() => {});
  }, []);
  const submit = async () => {
    try {
      setSaving(true);
      await createDebt({
        counterpartyName: name,
        direction,
        amountMinor: parseAmountInput(amount),
        walletId,
        dueDate: dueDate || null,
      });
      router.replace("/debts" as any);
    } catch (error) {
      Alert.alert(
        "Could not record debt",
        error instanceof Error ? error.message : "Unknown error",
      );
    } finally {
      setSaving(false);
    }
  };
  return (
    <ScreenShell>
      <BrandHeader title="Record debt" />
      <ScrollView
        className="flex-1 bg-background"
        contentContainerClassName="p-4"
      >
        <Text className="mb-1 text-sm font-semibold text-foreground">
          Person
        </Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="e.g. Alex"
          placeholderTextColor={tokens.muted}
          className="mb-4 rounded-xl border border-border bg-card px-3 py-3 text-foreground"
        />
        <View className="mb-4 flex-row gap-2">
          {(["owed_to_me", "i_owe"] as const).map((value) => (
            <Pressable
              key={value}
              className={`flex-1 rounded-xl px-2 py-3 ${direction === value ? "bg-primary" : "border border-border bg-card"}`}
              onPress={() => setDirection(value)}
            >
              <Text
                className={`text-center font-semibold ${direction === value ? "text-primary-foreground" : "text-foreground"}`}
              >
                {value === "owed_to_me" ? "They owe me" : "I owe them"}
              </Text>
            </Pressable>
          ))}
        </View>
        <Text className="mb-1 text-sm font-semibold text-foreground">
          Amount
        </Text>
        <AmountInput
          value={amount}
          onChangeValue={setAmount}
          placeholder="0.00"
          placeholderTextColor={tokens.muted}
          className="mb-4 rounded-xl border border-border bg-card px-3 py-3 text-foreground"
          currency={wallets.find((wallet) => wallet.id === walletId)?.currency}
        />
        <Text className="mb-2 text-sm font-semibold text-foreground">
          Cash wallet
        </Text>
        <View className="mb-4 flex-row flex-wrap gap-2">
          {wallets.map((wallet) => (
            <Pressable
              key={wallet.id}
              className={`rounded-lg px-3 py-2 ${walletId === wallet.id ? "bg-primary" : "border border-border bg-card"}`}
              onPress={() => setWalletId(wallet.id)}
            >
              <Text
                className={
                  walletId === wallet.id
                    ? "text-primary-foreground"
                    : "text-foreground"
                }
              >
                {wallet.name} · {wallet.currency}
              </Text>
            </Pressable>
          ))}
        </View>
        <Text className="mb-1 text-sm font-semibold text-foreground">
          Due date (optional)
        </Text>
        <TextInput
          value={dueDate}
          onChangeText={setDueDate}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={tokens.muted}
          className="mb-6 rounded-xl border border-border bg-card px-3 py-3 text-foreground"
        />
        <PrimaryButton
          label="Save debt"
          loading={saving}
          loadingLabel="Saving…"
          onPress={submit}
          disabled={saving}
        />
      </ScrollView>
    </ScreenShell>
  );
}
