import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import type { ColorValue } from 'react-native';
import {
  router,
  useFocusEffect,
  useLocalSearchParams,
} from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { createTransactionSchema } from '@repo/types';

import { BrandHeader } from '@/components/ui/brand-header';
import { CategoryIcon } from '@/components/categories/category-icon';
import { chipClass, chipTextClass } from '@/components/ui/chip';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { NumericKeypad } from '@/components/ui/numeric-keypad';
import { PrimaryButton } from '@/components/ui/primary-button';
import { ScreenShell } from '@/components/ui/screen-shell';
import { Surface } from '@/components/ui/surface';
import { WalletIcon } from '@/components/wallets/wallet-icon';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { useAuth } from '@/lib/auth/auth-context';
import { parseAmountInput } from '@/lib/finance/money';
import { getCategories } from '@/lib/supabase/categories';
import {
  createTransaction,
  createTransfer,
} from '@/lib/supabase/transactions';
import { getWallets } from '@/lib/supabase/wallets';
import {
  getDraftExtras,
  hasDraftExtras,
  resetDraftExtras,
} from '@/lib/transactions/draft-extras';

const QUICK_AMOUNTS = [10, 20, 50, 100, 500];
const MAX_AMOUNT_LENGTH = 12;

type Wallet = Awaited<ReturnType<typeof getWallets>>[number];
type Category = Awaited<ReturnType<typeof getCategories>>[number];
type TransactionKind = 'income' | 'expense' | 'transfer';

const transactionCopy: Record<TransactionKind, string> = {
  expense: 'Expense',
  income: 'Income',
  transfer: 'Transfer',
};

export default function NewTransactionScreen() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const tokens = useThemeTokens();
  const params = useLocalSearchParams<{
    walletId?: string | string[];
  }>();
  const paramWalletId = useMemo(() => {
    const value = params.walletId;
    return Array.isArray(value) ? value[0] : value;
  }, [params.walletId]);

  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [walletId, setWalletId] = useState('');
  const [transferToWalletId, setTransferToWalletId] = useState('');
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<TransactionKind>('expense');
  const [categoryId, setCategoryId] = useState('');
  const [saving, setSaving] = useState(false);
  const [extras, setExtras] = useState(getDraftExtras());

  useEffect(() => {
    resetDraftExtras();
  }, []);

  useFocusEffect(
    useCallback(() => {
      setExtras(getDraftExtras());
    }, []),
  );

  useEffect(() => {
    if (!user) return;
    void getWallets().then(setWallets);
    if (type !== 'transfer')
      void getCategories(type).then(setCategories);
  }, [type, user]);

  useEffect(() => {
    if (wallets.length === 0) return;
    if (
      paramWalletId &&
      wallets.some((wallet) => wallet.id === paramWalletId)
    ) {
      setWalletId(paramWalletId);
    } else {
      setWalletId((current) => current || wallets[0].id);
    }
    setTransferToWalletId((current) => {
      if (current) return current;
      return (
        wallets.find(
          (wallet) => wallet.id !== (paramWalletId ?? wallets[0].id),
        )?.id ?? ''
      );
    });
  }, [paramWalletId, wallets]);

  const selectedWallet = wallets.find(
    (wallet) => wallet.id === walletId,
  );
  const destinationWallets = useMemo(
    () => wallets.filter((wallet) => wallet.id !== walletId),
    [walletId, wallets],
  );

  const handleKeyPress = useCallback((key: string) => {
    setAmount((previous) => {
      if (key === '⌫') return previous.slice(0, -1);
      if (key === '.' && previous.includes('.')) return previous;
      if (previous.length >= MAX_AMOUNT_LENGTH) return previous;
      if (key === '.' && previous.length === 0) return '0.';
      return previous + key;
    });
  }, []);

  const handleOpenDetails = useCallback(() => {
    router.push({
      pathname: '/transaction/new-details',
      params: { type },
    } as never);
  }, [type]);

  const handleSubmit = async () => {
    if (!user || !walletId) return;

    let amountMinor: ReturnType<typeof parseAmountInput>;
    try {
      amountMinor = parseAmountInput(amount);
    } catch {
      Alert.alert(
        'Enter an amount',
        'Use a positive amount to continue.',
      );
      return;
    }

    setSaving(true);
    try {
      if (type === 'transfer') {
        if (!transferToWalletId) {
          Alert.alert(
            'Choose a destination',
            'Select another wallet for this transfer.',
          );
          return;
        }
        await createTransfer({
          fromWalletId: walletId,
          toWalletId: transferToWalletId,
          amountMinor,
          description: extras.description.trim() || null,
        });
      } else {
        const locationPayload = extras.locationSnapshot
          ? {
              locationLatitude: extras.locationSnapshot.latitude,
              locationLongitude: extras.locationSnapshot.longitude,
              locationName: extras.locationSnapshot.name,
            }
          : {};
        const parsed = createTransactionSchema.safeParse({
          walletId,
          amountMinor,
          type,
          categoryId: categoryId || null,
          merchant: extras.merchant.trim() || null,
          description: extras.description.trim() || null,
          transactionDate: new Date().toISOString(),
          ...locationPayload,
        });
        if (!parsed.success) {
          Alert.alert(
            'Check this transaction',
            parsed.error.errors[0]?.message ?? 'Enter valid details.',
          );
          return;
        }
        await createTransaction(parsed.data);
      }
      resetDraftExtras();
      router.back();
    } catch (error) {
      Alert.alert(
        'Could not add transaction',
        error instanceof Error ? error.message : 'Please try again.',
      );
    } finally {
      setSaving(false);
    }
  };

  const actionLabel =
    type === 'income'
      ? 'Add income'
      : type === 'transfer'
        ? 'Move money'
        : 'Add expense';
  const detailsAdded = hasDraftExtras(extras);

  return (
    <ScreenShell variant="canvas">
      <BrandHeader title="New transaction" />
      <View className="flex-1">
        <ScrollView
          className="flex-1"
          contentContainerClassName="px-5 pb-8 pt-6"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View className="mt-6 flex-row gap-2">
            {(['expense', 'income', 'transfer'] as const).map(
              (option) => {
                const selected = type === option;
                return (
                  <TouchableOpacity
                    key={option}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    activeOpacity={0.82}
                    className={`${chipClass(selected)} min-h-12 flex-1 items-center justify-center px-2`}
                    onPress={() => setType(option)}
                  >
                    <Text
                      className={`text-sm font-semibold ${chipTextClass(selected)}`}
                    >
                      {transactionCopy[option]}
                    </Text>
                  </TouchableOpacity>
                );
              },
            )}
          </View>

          <Surface
            tone="raised"
            className="mt-6 items-center px-5 pb-5 pt-6"
          >
            <Text className="text-sm font-semibold text-muted">
              Amount
            </Text>
            <Text className="mt-2 text-center text-5xl font-bold text-foreground">
              {amount || '0'}
            </Text>
            <Text className="mt-2 text-sm font-semibold text-primary">
              {selectedWallet?.currency?.toUpperCase() ??
                'Choose a wallet'}
            </Text>
            <View className="mt-6 flex-row flex-wrap justify-center gap-2">
              {QUICK_AMOUNTS.map((quickAmount) => (
                <TouchableOpacity
                  key={quickAmount}
                  accessibilityLabel={`Set amount to ${quickAmount}`}
                  activeOpacity={0.82}
                  className="min-h-10 rounded-full bg-card px-4 py-2"
                  onPress={() => setAmount(String(quickAmount))}
                >
                  <Text className="text-sm font-semibold text-foreground">
                    {quickAmount}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </Surface>

          <View className="mt-5">
            <NumericKeypad onKeyPress={handleKeyPress} />
          </View>

          <Text className="mb-2 mt-8 text-base font-bold text-foreground">
            {type === 'transfer' ? 'From wallet' : 'Paid from'}
          </Text>
          {wallets.length === 0 ? (
            <Surface
              tone="muted"
              className="p-4"
            >
              <Text className="font-semibold text-foreground">
                No wallet yet
              </Text>
              <Text className="mt-1 text-sm leading-5 text-muted">
                Add a wallet first so Moni can keep this transaction
                in the right currency.
              </Text>
            </Surface>
          ) : (
            <View className="flex-row flex-wrap gap-2">
              {wallets.map((wallet) => {
                const selected = wallet.id === walletId;
                const iconColor: ColorValue = selected
                  ? tokens.primary
                  : tokens.foreground;
                return (
                  <TouchableOpacity
                    key={wallet.id}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    activeOpacity={0.82}
                    className={`${chipClass(selected)} min-h-11 justify-center px-3`}
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
                        className={`text-sm ${chipTextClass(selected)}`}
                        numberOfLines={1}
                      >
                        {wallet.name} · {wallet.currency}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {type === 'transfer' ? (
            <>
              <Text className="mb-2 mt-7 text-base font-bold text-foreground">
                Move to
              </Text>
              <View className="flex-row flex-wrap gap-2">
                {destinationWallets.map((wallet) => {
                  const selected = wallet.id === transferToWalletId;
                  const iconColor: ColorValue = selected
                    ? tokens.primary
                    : tokens.foreground;
                  return (
                    <TouchableOpacity
                      key={wallet.id}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      activeOpacity={0.82}
                      className={`${chipClass(selected)} min-h-11 justify-center px-3`}
                      onPress={() => setTransferToWalletId(wallet.id)}
                    >
                      <View className="flex-row items-center gap-1.5">
                        <WalletIcon
                          color={iconColor}
                          icon={wallet.icon}
                          size={16}
                          type={wallet.type}
                        />
                        <Text
                          className={`text-sm ${chipTextClass(selected)}`}
                          numberOfLines={1}
                        >
                          {wallet.name} · {wallet.currency}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <Text className="mt-3 text-sm leading-5 text-muted">
                Transfers move money between wallets without changing
                your overall net worth.
              </Text>
            </>
          ) : (
            <>
              <Text className="mb-2 mt-7 text-base font-bold text-foreground">
                Category
              </Text>
              <View className="flex-row flex-wrap gap-2">
                {categories.map((category) => {
                  const selected = category.id === categoryId;
                  return (
                    <TouchableOpacity
                      key={category.id}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      activeOpacity={0.82}
                      className={`${chipClass(selected)} min-h-11 justify-center px-3`}
                      onPress={() => setCategoryId(category.id)}
                    >
                      <View className="flex-row items-center gap-1.5">
                        <CategoryIcon
                          color={
                            selected
                              ? tokens.primary
                              : (category.color ?? tokens.foreground)
                          }
                          icon={category.icon}
                          size={16}
                        />
                        <Text
                          className={`text-sm ${chipTextClass(selected)}`}
                          numberOfLines={1}
                        >
                          {category.name}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
              {categories.length === 0 ? (
                <Text className="mt-2 text-sm text-muted">
                  No categories are available for this transaction
                  type.
                </Text>
              ) : null}
            </>
          )}

          <TouchableOpacity
            accessibilityRole="button"
            activeOpacity={0.82}
            className="mt-8 flex-row items-center justify-between rounded-[22px] bg-card p-4"
            onPress={handleOpenDetails}
          >
            <View className="flex-1 flex-row items-center gap-3 pr-3">
              <View className="h-10 w-10 items-center justify-center rounded-full bg-primary-muted">
                <IconSymbol
                  color={tokens.primary}
                  name="tune"
                  size={20}
                />
              </View>
              <View className="flex-1">
                <Text className="text-[15px] font-semibold text-foreground">
                  {detailsAdded
                    ? 'More details added'
                    : 'Add details'}
                </Text>
                <Text className="mt-1 text-sm text-muted">
                  Merchant, notes, and current location.
                </Text>
              </View>
            </View>
            <IconSymbol
              color={tokens.muted}
              name="chevron-right"
              size={22}
            />
          </TouchableOpacity>
        </ScrollView>

        <View
          className="border-t border-border-subtle bg-canvas px-5 pt-3"
          style={{ paddingBottom: Math.max(insets.bottom, 12) }}
        >
          <PrimaryButton
            disabled={!walletId}
            icon="check"
            label={actionLabel}
            loading={saving}
            loadingLabel="Saving transaction…"
            onPress={handleSubmit}
          />
        </View>
      </View>
    </ScreenShell>
  );
}
