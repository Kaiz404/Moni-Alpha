import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, View } from 'react-native';
import { Text } from '@/components/ui/text';
import type { ColorValue } from 'react-native';
import { router } from 'expo-router';
import type { DebtDirection } from '@repo/types';

import { AmountInput } from '@/components/finance/amount-input';
import { FeedbackState } from '@/components/ui/feedback-state';
import { FormField } from '@/components/ui/form-field';
import { WalletIcon } from '@/components/wallets/wallet-icon';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { parseAmountInput } from '@/lib/finance/money';
import { createDebt } from '@/lib/supabase/debts';
import { getWallets } from '@/lib/supabase/wallets';
import { Button } from '@/components/ui/button';
import { tid } from '@/lib/test-ids';
import { Page } from '@/components/ui/page';

type Wallet = Awaited<ReturnType<typeof getWallets>>[number];

export default function NewDebtScreen() {
  const tokens = useThemeTokens();
  const [name, setName] = useState('');
  const [direction, setDirection] =
    useState<DebtDirection>('owed_to_me');
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
  const selectedWallet = wallets.find(
    (wallet) => wallet.id === walletId,
  );

  return (
    <Page
      screen="debts"
      kind="pushed"
      title="Record debt"
    >
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-5 pb-10 pt-6"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View className="flex-row gap-2">
          {(['owed_to_me', 'i_owe'] as const).map((option) => {
            const selected = direction === option;
            return (
              <Pressable
                testID={tid('debts', 'set-direction', option)}
                key={option}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                className={`min-h-14 flex-1 justify-center rounded-2xl px-4 ${selected ? (option === 'owed_to_me' ? 'border border-primary bg-primary-muted' : 'border border-warning bg-warning/10') : 'bg-card'}`}
                onPress={() => setDirection(option)}
              >
                <Text
                  className={`text-center text-[15px] font-display-bold ${selected && option === 'owed_to_me' ? 'text-primary' : 'text-foreground'}`}
                >
                  {option === 'owed_to_me'
                    ? 'They owe me'
                    : 'I owe them'}
                </Text>
                <Text className="mt-1 text-center text-xs text-muted">
                  {option === 'owed_to_me'
                    ? 'You are owed'
                    : 'You need to repay'}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View className="rounded-card bg-card mt-6 p-5 overflow-hidden">
          <FormField
            testID={tid('debts', 'person')}
            label="Person"
            placeholder="e.g. Alex"
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
          />
          <Text className="mb-2 text-[15px] font-display-semibold text-foreground">
            Amount
          </Text>
          <AmountInput
            accessibilityLabel="Debt amount"
            className="min-h-14 px-4 py-3 text-right text-2xl font-display-bold text-foreground"
            currency={selectedWallet?.currency}
            onChangeValue={setAmount}
            placeholder="0.00"
            placeholderTextColor={tokens.muted}
            value={amount}
          />
          <Text className="mt-2 text-xs leading-4 text-muted">
            Currency comes from the wallet selected below. Moni does
            not convert it.
          </Text>
          <FormField
            testID={tid('debts', 'due-date')}
            containerClassName="mt-5"
            label="Due date"
            hint="Optional · YYYY-MM-DD"
            placeholder="2026-08-01"
            value={dueDate}
            onChangeText={setDueDate}
            autoCapitalize="none"
          />
        </View>

        <Text className="mb-2 mt-8 text-base font-display-bold text-foreground">
          Cash wallet
        </Text>
        {wallets.length === 0 ? (
          <FeedbackState
            icon="wallet"
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
                  testID={tid('debts', 'set-wallet-id', wallet.id)}
                  key={wallet.id}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  className={`min-h-11 justify-center rounded-xl px-3 ${selected ? (owedToMe ? 'border border-primary bg-primary-muted' : 'border border-warning bg-warning/10') : 'bg-card'}`}
                  onPress={() => setWalletId(wallet.id)}
                >
                  <View className="flex-row items-center gap-1.5">
                    <WalletIcon
                      color={iconColor}
                      icon={wallet.icon}
                      size={16}
                      type={wallet.type}
                    />
                    <Text
                      className={`text-sm font-display-semibold ${selected && owedToMe ? 'text-primary' : 'text-foreground'}`}
                    >
                      {wallet.name} · {wallet.currency}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}

        <Button
          testID={tid('debts', 'record-money-owed')}
          className="mt-8"
          disabled={!walletId}
          label={
            owedToMe
              ? 'Record money owed to me'
              : 'Record money I owe'
          }
          loading={saving}
          loadingLabel="Saving debt…"
          onPress={submit}
        />
      </ScrollView>
    </Page>
  );
}
