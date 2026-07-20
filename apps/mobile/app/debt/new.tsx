import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import type { ColorValue } from 'react-native';
import { router } from 'expo-router';
import type { DebtDirection } from '@repo/types';

import { AmountInput } from '@/components/finance/amount-input';
import { BrandHeader } from '@/components/ui/brand-header';
import { FeedbackState } from '@/components/ui/feedback-state';
import { FormField } from '@/components/ui/form-field';
import { PrimaryButton } from '@/components/ui/primary-button';
import { ScreenShell } from '@/components/ui/screen-shell';
import { Surface } from '@/components/ui/surface';
import { WalletIcon } from '@/components/wallets/wallet-icon';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { parseAmountInput } from '@/lib/finance/money';
import { createDebt } from '@/lib/supabase/debts';
import { getWallets } from '@/lib/supabase/wallets';

type Wallet = Awaited<ReturnType<typeof getWallets>>[number];

export default function NewDebtScreen() {
  const tokens = useThemeTokens();
  const [name, setName] = useState('');
  const [direction, setDirection] = useState<DebtDirection>('owed_to_me');
  const [amount, setAmount] = useState('');
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [walletId, setWalletId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void getWallets()
      .then((items) => {
        setWallets(items);
        setWalletId(items[0]?.id ?? '');
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
      router.replace('/debts' as never);
    } catch (error) {
      Alert.alert(
        'Could not record debt',
        error instanceof Error ? error.message : 'Please try again.',
      );
    } finally {
      setSaving(false);
    }
  };

  const owedToMe = direction === 'owed_to_me';
  const selectedWallet = wallets.find((wallet) => wallet.id === walletId);

  return (
    <ScreenShell variant="canvas">
      <BrandHeader title="Record debt" />
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-5 pb-10 pt-6"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text className="text-2xl font-bold text-foreground">Keep it clear</Text>
        <Text className="mt-2 text-[15px] leading-5 text-muted">
          Record who is involved, the native-currency amount, and an optional
          due date. You stay in control of every later repayment.
        </Text>

        <View className="mt-6 flex-row gap-2">
          {(['owed_to_me', 'i_owe'] as const).map((option) => {
            const selected = direction === option;
            return (
              <Pressable
                key={option}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                className={`min-h-14 flex-1 justify-center rounded-2xl px-4 ${selected ? option === 'owed_to_me' ? 'border border-primary bg-primary-muted' : 'border border-warning bg-warning/10' : 'bg-card'}`}
                onPress={() => setDirection(option)}
              >
                <Text className={`text-center text-[15px] font-bold ${selected && option === 'owed_to_me' ? 'text-primary' : 'text-foreground'}`}>
                  {option === 'owed_to_me' ? 'They owe me' : 'I owe them'}
                </Text>
                <Text className="mt-1 text-center text-xs text-muted">
                  {option === 'owed_to_me' ? 'You are owed' : 'You need to repay'}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Surface className="mt-6 p-5">
          <FormField
            label="Person"
            placeholder="e.g. Alex"
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
          />
          <Text className="mb-2 text-[15px] font-semibold text-foreground">Amount</Text>
          <AmountInput
            accessibilityLabel="Debt amount"
            className="min-h-14 px-4 py-3 text-right text-2xl font-bold text-foreground"
            currency={selectedWallet?.currency}
            onChangeValue={setAmount}
            placeholder="0.00"
            placeholderTextColor={tokens.muted}
            value={amount}
          />
          <Text className="mt-2 text-xs leading-4 text-muted">
            Currency comes from the wallet selected below. Moni does not convert it.
          </Text>
          <FormField
            containerClassName="mt-5"
            label="Due date"
            hint="Optional · YYYY-MM-DD"
            placeholder="2026-08-01"
            value={dueDate}
            onChangeText={setDueDate}
            autoCapitalize="none"
          />
        </Surface>

        <Text className="mb-2 mt-8 text-base font-bold text-foreground">Cash wallet</Text>
        <Text className="mb-3 text-sm leading-5 text-muted">
          This creates the matching cash entry in a wallet using the same
          currency.
        </Text>
        {wallets.length === 0 ? (
          <FeedbackState
            description="Add a wallet before recording a cash debt."
            icon="account-balance-wallet"
            title="No wallet available"
          />
        ) : (
          <View className="flex-row flex-wrap gap-2">
            {wallets.map((wallet) => {
              const selected = walletId === wallet.id;
              const iconColor: ColorValue = selected
                ? tokens.primary
                : tokens.foreground;
              return (
                <Pressable
                  key={wallet.id}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  className={`min-h-11 justify-center rounded-xl px-3 ${selected ? owedToMe ? 'border border-primary bg-primary-muted' : 'border border-warning bg-warning/10' : 'bg-card'}`}
                  onPress={() => setWalletId(wallet.id)}
                >
                  <View className="flex-row items-center gap-1.5">
                    <WalletIcon
                      color={iconColor}
                      icon={wallet.icon}
                      size={16}
                      type={wallet.type}
                    />
                    <Text className={`text-sm font-semibold ${selected && owedToMe ? 'text-primary' : 'text-foreground'}`}>
                      {wallet.name} · {wallet.currency}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}

        <PrimaryButton
          className="mt-8"
          disabled={!walletId}
          label={owedToMe ? 'Record money owed to me' : 'Record money I owe'}
          loading={saving}
          loadingLabel="Saving debt…"
          onPress={submit}
        />
      </ScrollView>
    </ScreenShell>
  );
}
