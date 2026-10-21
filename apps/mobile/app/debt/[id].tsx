import { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, View } from 'react-native';
import { Text } from '@/components/ui/text';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { AmountInput } from '@/components/finance/amount-input';
import { FeedbackState } from '@/components/ui/feedback-state';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import {
  addDebtPrincipal,
  debtDueState,
  deleteDebtActivity,
  getDebtActivities,
  getDebtById,
  outstandingDebtBalance,
  repayDebt,
  writeOffDebt,
} from '@/lib/supabase/debts';
import { getWallets } from '@/lib/supabase/wallets';
import type { Debt, DebtActivity } from '@repo/types';
import {
  formatMinorAmount,
  parseAmountInput,
  type MinorAmount,
} from '@/lib/finance/money';
import { Button } from '@/components/ui/button';
import { openSheet } from '@/lib/sheet/sheet-store';
import { tid } from '@/lib/test-ids';
import { Page } from '@/components/ui/page';

const money = (currency: string, amountMinor: MinorAmount) =>
  formatMinorAmount(amountMinor, currency);
const normalizeCurrency = (currency: unknown) =>
  String(currency ?? 'USD')
    .trim()
    .toUpperCase();
export default function DebtDetailScreen() {
  const tokens = useThemeTokens();
  type WalletItem = Awaited<ReturnType<typeof getWallets>>[number];
  const { id } = useLocalSearchParams<{ id: string }>();
  const [debt, setDebt] = useState<Debt | null>(null);
  const [activities, setActivities] = useState<DebtActivity[]>([]);
  const [wallets, setWallets] = useState<WalletItem[]>([]);
  const [action, setAction] = useState<
    'principal' | 'repayment' | null
  >(null);
  const [amount, setAmount] = useState('');
  const [walletId, setWalletId] = useState('');
  const [saving, setSaving] = useState(false);
  const load = useCallback(async () => {
    if (!id) return;
    const [item, events, walletRows] = await Promise.all([
      getDebtById(id),
      getDebtActivities(id),
      getWallets(),
    ]);
    const firstEligible =
      walletRows.find(
        (wallet) =>
          normalizeCurrency(wallet.currency) ===
          normalizeCurrency(item?.currency),
      )?.id ?? '';
    setDebt(item);
    setActivities(events);
    setWallets(walletRows);
    setWalletId((old) =>
      walletRows.some(
        (wallet) =>
          wallet.id === old &&
          normalizeCurrency(wallet.currency) ===
            normalizeCurrency(item?.currency),
      )
        ? old
        : firstEligible,
    );
  }, [id]);
  useFocusEffect(
    useCallback(() => {
      load().catch(() => {});
    }, [load]),
  );
  const balance = useMemo(
    () => outstandingDebtBalance(activities),
    [activities],
  );
  if (!debt)
    return (
      <Page
        screen="debts"
        kind="pushed"
        title="Debt"
      >
        <FeedbackState
          className="flex-1"
          icon="account-outline"
          title="Debt not found"
        />
      </Page>
    );
  const matchingWallets = wallets.filter(
    (wallet) =>
      normalizeCurrency(wallet.currency) ===
      normalizeCurrency(debt.currency),
  );
  const openCashAction = (nextAction: 'principal' | 'repayment') => {
    const selectedIsEligible = matchingWallets.some(
      (wallet) => wallet.id === walletId,
    );
    setWalletId(
      selectedIsEligible ? walletId : (matchingWallets[0]?.id ?? ''),
    );
    setAction(nextAction);
  };
  const submit = async () => {
    const selectedWalletId = matchingWallets.some(
      (wallet) => wallet.id === walletId,
    )
      ? walletId
      : matchingWallets[0]?.id;
    if (!selectedWalletId) {
      Alert.alert(
        'No matching wallet',
        `Add or reactivate a ${debt.currency} wallet before recording a cash debt activity.`,
      );
      return;
    }
    try {
      setSaving(true);
      if (!action) return;
      if (action === 'principal')
        await addDebtPrincipal(
          debt,
          parseAmountInput(amount),
          selectedWalletId,
        );
      else
        await repayDebt(
          debt,
          parseAmountInput(amount),
          selectedWalletId,
        );
      setAction(null);
      setAmount('');
      await load();
    } catch (error) {
      Alert.alert(
        'Could not save activity',
        error instanceof Error ? error.message : 'Unknown error',
      );
    } finally {
      setSaving(false);
    }
  };
  const writeOff = async () => {
    const confirmed = await openSheet({
      kind: 'confirm',
      title: 'Write off this debt?',
      message: `This records ${money(debt.currency, balance)} as settled without money moving.`,
      confirmLabel: 'Write off',
      cancelLabel: 'Keep it',
      destructive: true,
    });
    if (!confirmed) return;
    writeOffDebt(debt)
      .then(load)
      .catch((error) =>
        Alert.alert('Could not write off', error.message),
      );
  };
  return (
    <Page
      screen="debts"
      kind="pushed"
      title={debt.counterpartyName}
    >
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-5 pb-10 pt-6"
      >
        <View className="rounded-card bg-card mb-4 p-4 overflow-hidden">
          <Text className="text-sm text-muted">
            {debt.direction === 'owed_to_me'
              ? 'They owe you'
              : 'You owe them'}{' '}
            · {debtDueState(debt, balance).replace('_', ' ')}
          </Text>
          <Text className="mt-1 text-3xl font-display-bold text-foreground">
            {money(debt.currency, balance)}
          </Text>
          {debt.dueDate ? (
            <Text className="mt-1 text-sm text-muted">
              Due {debt.dueDate}
            </Text>
          ) : null}
        </View>
        {action ? (
          <View className="rounded-card bg-card mb-4 p-3 overflow-hidden">
            <Text className="font-display-bold text-foreground">
              {action === 'principal'
                ? debt.direction === 'owed_to_me'
                  ? 'Lend more'
                  : 'Borrow more'
                : 'Record repayment'}
            </Text>
            <AmountInput
              value={amount}
              onChangeValue={setAmount}
              placeholder="Amount"
              placeholderTextColor={tokens.muted}
              className="mt-3 rounded-lg border border-border bg-background px-3 py-2 text-foreground"
              currency={debt.currency}
            />
            {matchingWallets.length ? (
              <View className="mt-2 flex-row flex-wrap gap-2">
                {matchingWallets.map((wallet) => (
                  <Pressable
                    testID={tid('debts', 'set-wallet-id', wallet.id)}
                    key={wallet.id}
                    className={`rounded-lg px-3 py-2 ${walletId === wallet.id ? 'bg-primary' : 'bg-surface-2'}`}
                    onPress={() => setWalletId(wallet.id)}
                  >
                    <Text
                      className={
                        walletId === wallet.id
                          ? 'text-primary-foreground'
                          : 'text-foreground'
                      }
                    >
                      {wallet.name}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : (
              <View className="mt-3 rounded-lg bg-danger/10 p-3">
                <Text className="text-sm text-danger">
                  No active {debt.currency} wallet is available. Add
                  or reactivate one, then try again.
                </Text>
              </View>
            )}
            <View className="mt-3 flex-row gap-2">
              <Button
                testID={tid('debts', 'cancel')}
                variant="secondary"
                label="Cancel"
                className="flex-1"
                onPress={() => setAction(null)}
              />
              <Button
                testID={tid('debts', 'save')}
                label="Save"
                loading={saving}
                disabled={!matchingWallets.length || saving}
                className="flex-1"
                onPress={submit}
              />
            </View>
          </View>
        ) : (
          <View className="mb-4 flex-row gap-2">
            <Button
              testID={tid('debts', 'lend-more')}
              label={
                debt.direction === 'owed_to_me'
                  ? 'Lend more'
                  : 'Borrow more'
              }
              className="flex-1"
              onPress={() => openCashAction('principal')}
            />
            <Button
              testID={tid('debts', 'repayment')}
              label="Repayment"
              className="flex-1"
              onPress={() => openCashAction('repayment')}
            />
          </View>
        )}
        {balance > 0 ? (
          <Pressable
            testID={tid('debts', 'write-off-remaining')}
            className="mb-4 self-start"
            onPress={writeOff}
          >
            <Text className="font-display-semibold text-expense">
              Write off remaining balance
            </Text>
          </Pressable>
        ) : null}
        <Text className="mb-2 text-base font-display-bold text-foreground">
          Activity
        </Text>
        {activities.map((item) => (
          <View
            key={item.id}
            className="mb-2 rounded-xl bg-card p-3"
          >
            <View className="flex-row justify-between">
              <Text className="font-display-semibold text-foreground">
                {item.kind.replace('_', ' ')}
              </Text>
              <Text className="font-display-semibold text-foreground">
                {money(debt.currency, item.amountMinor)}
              </Text>
            </View>
            <Text className="mt-1 text-sm text-muted">
              {new Date(item.activityDate).toLocaleDateString()}{' '}
              {item.walletId ? '· Cash wallet' : '· Non-cash'}
            </Text>
            <Pressable
              testID={tid('debts', 'remove', item.id)}
              className="mt-2 self-start"
              onPress={async () => {
                const confirmed = await openSheet({
                  kind: 'confirm',
                  title: 'Remove this activity?',
                  message: 'Its wallet transaction goes too.',
                  confirmLabel: 'Remove',
                  cancelLabel: 'Keep it',
                  destructive: true,
                });
                if (confirmed)
                  void deleteDebtActivity(debt, item.id).then(load);
              }}
            >
              <Text className="text-sm text-expense">Remove</Text>
            </Pressable>
          </View>
        ))}
      </ScrollView>
    </Page>
  );
}
