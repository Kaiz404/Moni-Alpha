import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  Text,
  View,
} from 'react-native';
import {
  router,
  useLocalSearchParams,
} from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useValue } from '@legendapp/state/react';
import { createTransactionSchema } from '@repo/types';

import { CategoryIcon } from '@/components/categories/category-icon';
import { CategoryPickerModal } from '@/components/categories/category-picker-modal';
import { TransactionDetailsSheet } from '@/components/transaction/transaction-details-sheet';
import type { TransactionDetailsValue } from '@/components/transaction/transaction-details-sheet-content';
import { TransactionModifierChip } from '@/components/transaction/transaction-selector-row';
import { BrandHeader } from '@/components/ui/brand-header';
import { chipClass, chipTextClass } from '@/components/ui/chip';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { NumericKeypad } from '@/components/ui/numeric-keypad';
import { PrimaryButton } from '@/components/ui/primary-button';
import { ScreenShell } from '@/components/ui/screen-shell';
import { WalletIcon } from '@/components/wallets/wallet-icon';
import { WalletPickerModal } from '@/components/wallets/wallet-picker-modal';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { useAuth } from '@/lib/auth/auth-context';
import {
  isoToLocalDateInput,
  localDateInputToIso,
} from '@/lib/dates/local-date-input';
import { recentExpenseCategories$ } from '@/lib/finance/selectors';
import { parseAmountInput } from '@/lib/finance/money';
import { getCategories } from '@/lib/supabase/categories';
import {
  createTransaction,
  createTransfer,
} from '@/lib/supabase/transactions';
import { getWallets } from '@/lib/supabase/wallets';
import { prefetchTransactionLocation } from '@/lib/transactions/prefetch-location';

const MAX_AMOUNT_LENGTH = 12;

type Wallet = Awaited<ReturnType<typeof getWallets>>[number];
type Category = Awaited<ReturnType<typeof getCategories>>[number];
type TransactionKind = 'income' | 'expense' | 'transfer';

const transactionCopy: Record<TransactionKind, string> = {
  expense: 'Expense',
  income: 'Income',
  transfer: 'Transfer',
};

function hasDetails(
  value: TransactionDetailsValue,
  isTransfer: boolean,
): boolean {
  return Boolean(
    value.merchant.trim() ||
      value.description.trim() ||
      (!isTransfer && value.locationSnapshot) ||
      value.transactionDate !== isoToLocalDateInput(new Date().toISOString()),
  );
}

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
  const [walletPickerVisible, setWalletPickerVisible] = useState(false);
  const [destinationPickerVisible, setDestinationPickerVisible] =
    useState(false);
  const [categoryPickerVisible, setCategoryPickerVisible] =
    useState(false);
  const [detailsVisible, setDetailsVisible] = useState(false);
  const [details, setDetails] = useState<TransactionDetailsValue>(() => ({
    merchant: '',
    description: '',
    transactionDate: isoToLocalDateInput(new Date().toISOString()),
    locationSnapshot: null,
  }));
  const [locationLoading, setLocationLoading] = useState(true);
  const [locationUnavailable, setLocationUnavailable] = useState(false);

  const suggestedCategories = useValue(
    recentExpenseCategories$(user?.id ?? null),
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

  useEffect(() => {
    if (type === 'transfer') {
      setLocationLoading(false);
      return;
    }

    let cancelled = false;
    setLocationLoading(true);
    setLocationUnavailable(false);
    void prefetchTransactionLocation().then((snapshot) => {
      if (cancelled) return;
      if (snapshot) {
        setDetails((current) => ({
          ...current,
          locationSnapshot: snapshot,
        }));
      } else {
        setLocationUnavailable(true);
      }
      setLocationLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [type]);

  const selectedWallet = wallets.find(
    (wallet) => wallet.id === walletId,
  );
  const selectedDestination = wallets.find(
    (wallet) => wallet.id === transferToWalletId,
  );
  const selectedCategory = categories.find(
    (category) => category.id === categoryId,
  );
  const destinationWallets = useMemo(
    () => wallets.filter((wallet) => wallet.id !== walletId),
    [walletId, wallets],
  );
  const walletPickerItems = useMemo(
    () =>
      wallets.map((wallet) => ({
        id: wallet.id,
        name: wallet.name,
        currency: wallet.currency ?? 'USD',
        type: wallet.type,
        icon: wallet.icon,
      })),
    [wallets],
  );
  const categoryPickerItems = useMemo(
    () =>
      categories.map((category) => ({
        id: category.id,
        name: category.name ?? '',
        icon: category.icon,
        color: category.color,
      })),
    [categories],
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

  const patchDetails = useCallback(
    (patch: Partial<TransactionDetailsValue>) => {
      setDetails((current) => ({ ...current, ...patch }));
    },
    [],
  );

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
          description: details.description.trim() || null,
        });
      } else {
        const transactionDate =
          localDateInputToIso(details.transactionDate) ??
          new Date().toISOString();
        const locationPayload = details.locationSnapshot
          ? {
              locationLatitude: details.locationSnapshot.latitude,
              locationLongitude: details.locationSnapshot.longitude,
              locationName: details.locationSnapshot.name,
            }
          : {};
        const parsed = createTransactionSchema.safeParse({
          walletId,
          amountMinor,
          type,
          categoryId: categoryId || null,
          merchant: details.merchant.trim() || null,
          description: details.description.trim() || null,
          transactionDate,
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
  const isTransfer = type === 'transfer';
  const detailsAdded = hasDetails(details, isTransfer);

  return (
    <ScreenShell variant="canvas">
      <BrandHeader title="New transaction" />
      <View
        className="flex-1 px-5"
        style={{ paddingBottom: Math.max(insets.bottom, 12) }}
      >
        <View className="mt-3 flex-row gap-2">
          {(['expense', 'income', 'transfer'] as const).map(
            (option) => {
              const selected = type === option;
              return (
                <Pressable
                  key={option}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  className={`${chipClass(selected)} min-h-10 flex-1 items-center justify-center px-2`}
                  onPress={() => setType(option)}
                >
                  <Text
                    className={`text-sm font-semibold ${chipTextClass(selected)}`}
                  >
                    {transactionCopy[option]}
                  </Text>
                </Pressable>
              );
            },
          )}
        </View>

        <View className="flex-1 items-center justify-center">
          <Text className="text-6xl font-bold tracking-tight text-foreground">
            {amount || '0'}
          </Text>
          <Text className="mt-2 text-sm font-semibold text-primary">
            {selectedWallet?.currency?.toUpperCase() ??
              'Choose a wallet'}
          </Text>
        </View>

        <View className="pt-2">
          <View className="mb-3 flex-row items-stretch gap-2">
            <TransactionModifierChip
              accessibilityLabel={
                isTransfer
                  ? `From wallet, ${selectedWallet?.name ?? 'not selected'}`
                  : `Paid from, ${selectedWallet?.name ?? 'not selected'}`
              }
              value={selectedWallet?.name ?? ''}
              hint="Wallet"
              leading={
                <WalletIcon
                  color={tokens.primary}
                  icon={selectedWallet?.icon}
                  size={20}
                  type={selectedWallet?.type}
                />
              }
              onPress={() => setWalletPickerVisible(true)}
            />

            {isTransfer ? (
              <TransactionModifierChip
                accessibilityLabel={`Move to, ${selectedDestination?.name ?? 'not selected'}`}
                value={selectedDestination?.name ?? ''}
                hint="To"
                leading={
                  <WalletIcon
                    color={tokens.primary}
                    icon={selectedDestination?.icon}
                    size={20}
                    type={selectedDestination?.type}
                  />
                }
                onPress={() => setDestinationPickerVisible(true)}
              />
            ) : (
              <TransactionModifierChip
                accessibilityLabel={`Category, ${selectedCategory?.name ?? 'not selected'}`}
                value={selectedCategory?.name ?? ''}
                hint="Category"
                leading={
                  <CategoryIcon
                    color={
                      selectedCategory?.color ?? tokens.muted
                    }
                    icon={selectedCategory?.icon}
                    size={20}
                  />
                }
                onPress={() => setCategoryPickerVisible(true)}
              />
            )}

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="More details"
              className="relative min-h-[52px] w-[52px] items-center justify-center rounded-2xl bg-surface-2 active:opacity-85"
              onPress={() => setDetailsVisible(true)}
            >
              <IconSymbol
                color={tokens.foreground}
                name="tune"
                size={22}
              />
              {detailsAdded ? (
                <View className="absolute right-2 top-2 h-2 w-2 rounded-full bg-primary" />
              ) : null}
            </Pressable>
          </View>

          <NumericKeypad onKeyPress={handleKeyPress} />
          <PrimaryButton
            className="mt-3"
            disabled={!walletId}
            icon="check"
            label={actionLabel}
            loading={saving}
            loadingLabel="Saving transaction…"
            onPress={handleSubmit}
          />
        </View>
      </View>

      <WalletPickerModal
        visible={walletPickerVisible}
        wallets={walletPickerItems}
        selectedId={walletId}
        title={isTransfer ? 'From wallet' : 'Paid from'}
        subtitle="Pick the wallet for this transaction."
        onClose={() => setWalletPickerVisible(false)}
        onSelect={(wallet) => {
          setWalletId(wallet.id);
          if (transferToWalletId === wallet.id) {
            const next = destinationWallets.find(
              (item) => item.id !== wallet.id,
            );
            setTransferToWalletId(next?.id ?? '');
          }
        }}
      />

      <WalletPickerModal
        visible={destinationPickerVisible}
        wallets={destinationWallets.map((wallet) => ({
          id: wallet.id,
          name: wallet.name,
          currency: wallet.currency ?? 'USD',
          type: wallet.type,
          icon: wallet.icon,
        }))}
        selectedId={transferToWalletId}
        title="Move to"
        subtitle="Choose the destination wallet for this transfer."
        onClose={() => setDestinationPickerVisible(false)}
        onSelect={(wallet) => setTransferToWalletId(wallet.id)}
      />

      <CategoryPickerModal
        visible={categoryPickerVisible}
        categories={categoryPickerItems}
        suggested={type === 'expense' ? suggestedCategories : []}
        selectedId={categoryId}
        title="Choose category"
        onClose={() => setCategoryPickerVisible(false)}
        onSelect={(category) => setCategoryId(category.id)}
        onCreate={() => {
          router.push({
            pathname: '/categories/form',
            params: { type, returnTo: '/transaction/new' },
          } as never);
        }}
      />

      <TransactionDetailsSheet
        visible={detailsVisible}
        isTransfer={isTransfer}
        value={details}
        locationLoading={locationLoading}
        locationUnavailable={locationUnavailable}
        onChange={patchDetails}
        onClose={() => setDetailsVisible(false)}
      />
    </ScreenShell>
  );
}
