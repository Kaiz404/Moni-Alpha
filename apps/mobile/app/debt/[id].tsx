import { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  router,
  useFocusEffect,
  useLocalSearchParams,
} from 'expo-router';
import { BrandHeader } from '@/components/ui/brand-header';
import { AmountInput } from '@/components/finance/amount-input';
import { PrimaryButton } from '@/components/ui/primary-button';
import { ScreenShell } from '@/components/ui/screen-shell';
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
      <ScreenShell>
        <BrandHeader title="Debt" />
        <View className="flex-1 items-center justify-center">
          <Text className="text-muted">Debt not found.</Text>
        </View>
      </ScreenShell>
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
  const writeOff = () =>
    Alert.alert(
      'Write off debt?',
      `This records ${money(debt.currency, balance)} as non-cash settled.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Write off',
          style: 'destructive',
          onPress: () =>
            writeOffDebt(debt)
              .then(load)
              .catch((error) =>
                Alert.alert('Could not write off', error.message),
              ),
        },
      ],
    );
  return (
    <ScreenShell>
      <BrandHeader title={debt.counterpartyName} />
      <ScrollView
        className="flex-1 bg-background"
        contentContainerClassName="p-4"
      >
        <View className="mb-4 rounded-2xl bg-card p-4">
          <Text className="text-sm text-muted">
            {debt.direction === 'owed_to_me'
              ? 'They owe you'
              : 'You owe them'}{' '}
            · {debtDueState(debt, balance).replace('_', ' ')}
          </Text>
          <Text className="mt-1 text-3xl font-bold text-foreground">
            {money(debt.currency, balance)}
          </Text>
          {debt.dueDate ? (
            <Text className="mt-1 text-sm text-muted">
              Due {debt.dueDate}
            </Text>
          ) : null}
        </View>
        {action ? (
          <View className="mb-4 rounded-2xl border border-border bg-card p-3">
            <Text className="font-bold text-foreground">
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
                    key={wallet.id}
                    className={`rounded-lg px-3 py-2 ${walletId === wallet.id ? 'bg-primary' : 'border border-border'}`}
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
              <PrimaryButton
                label="Cancel"
                className="flex-1 bg-card"
                onPress={() => setAction(null)}
              />
              <PrimaryButton
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
            <PrimaryButton
              label={
                debt.direction === 'owed_to_me'
                  ? 'Lend more'
                  : 'Borrow more'
              }
              className="flex-1"
              onPress={() => openCashAction('principal')}
            />
            <PrimaryButton
              label="Repayment"
              className="flex-1"
              onPress={() => openCashAction('repayment')}
            />
          </View>
        )}
        {balance > 0 ? (
          <Pressable
            className="mb-4 self-start"
            onPress={writeOff}
          >
            <Text className="font-semibold text-expense">
              Write off remaining balance
            </Text>
          </Pressable>
        ) : null}
        <Text className="mb-2 text-base font-bold text-foreground">
          Activity
        </Text>
        {activities.map((item) => (
          <View
            key={item.id}
            className="mb-2 rounded-xl border border-border bg-card p-3"
          >
            <View className="flex-row justify-between">
              <Text className="font-semibold text-foreground">
                {item.kind.replace('_', ' ')}
              </Text>
              <Text className="font-semibold text-foreground">
                {money(debt.currency, item.amountMinor)}
              </Text>
            </View>
            <Text className="mt-1 text-sm text-muted">
              {new Date(item.activityDate).toLocaleDateString()}{' '}
              {item.walletId ? '· Cash wallet' : '· Non-cash'}
            </Text>
            <Pressable
              className="mt-2 self-start"
              onPress={() =>
                Alert.alert(
                  'Remove activity?',
                  'The linked wallet transaction will also be removed.',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Remove',
                      style: 'destructive',
                      onPress: () =>
                        deleteDebtActivity(debt, item.id).then(load),
                    },
                  ],
                )
              }
            >
              <Text className="text-sm text-expense">Remove</Text>
            </Pressable>
          </View>
        ))}
      </ScrollView>
    </ScreenShell>
  );
}
