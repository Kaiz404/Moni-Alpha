import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
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
import { getWalletCardStyle } from '@/constants/wallet-card-styles';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { useAuth } from '@/lib/auth/auth-context';
import {
  isoToLocalDateInput,
  localDateInputToIso,
} from '@/lib/dates/local-date-input';
import {
  budgetProgress$,
  categoriesForUser$,
  recentExpenseCategories$,
} from '@/lib/finance/selectors';
import {
  formatMinorAmount,
  parseAmountInput,
} from '@/lib/finance/money';
import { ensureFinanceTimezone } from '@/lib/supabase/profile';
import {
  createTransaction,
  createTransfer,
} from '@/lib/supabase/transactions';
import { getWallets } from '@/lib/supabase/wallets';
import { prefetchTransactionLocation } from '@/lib/transactions/prefetch-location';

const MAX_AMOUNT_LENGTH = 12;

type Wallet = Awaited<ReturnType<typeof getWallets>>[number];
type TransactionKind = 'income' | 'expense' | 'transfer';

function walletCurrency(wallet: Wallet): string {
  return (wallet.currency ?? 'USD').toUpperCase();
}

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
    type?: string | string[];
    categoryId?: string | string[];
  }>();
  const paramWalletId = useMemo(() => {
    const value = params.walletId;
    return Array.isArray(value) ? value[0] : value;
  }, [params.walletId]);
  const paramTransactionType = useMemo(() => {
    const value = Array.isArray(params.type)
      ? params.type[0]
      : params.type;
    return value === 'income' || value === 'expense'
      ? value
      : undefined;
  }, [params.type]);
  const paramCategoryId = useMemo(() => {
    const value = params.categoryId;
    return Array.isArray(value) ? value[0] : value;
  }, [params.categoryId]);

  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [timezone, setTimezone] = useState('UTC');
  const [walletId, setWalletId] = useState('');
  const [transferToWalletId, setTransferToWalletId] = useState('');
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<TransactionKind>(
    paramTransactionType ?? 'expense',
  );
  const [categoryId, setCategoryId] = useState('');
  const [saving, setSaving] = useState(false);
  const [walletPickerVisible, setWalletPickerVisible] =
    useState(false);
  const [destinationPickerVisible, setDestinationPickerVisible] =
    useState(false);
  const [categoryPickerVisible, setCategoryPickerVisible] =
    useState(false);
  const [detailsVisible, setDetailsVisible] = useState(false);
  const [details, setDetails] = useState<TransactionDetailsValue>(
    () => ({
      merchant: '',
      description: '',
      transactionDate: isoToLocalDateInput(new Date().toISOString()),
      locationSnapshot: null,
    }),
  );
  const [locationLoading, setLocationLoading] = useState(true);
  const [locationUnavailable, setLocationUnavailable] =
    useState(false);

  const suggestedCategories = useValue(
    recentExpenseCategories$(user?.id ?? null),
  );
  const allCategories = useValue(
    categoriesForUser$(user?.id ?? null),
  );
  const budgetProgress = useValue(
    budgetProgress$(user?.id ?? null, timezone),
  );
  const categories = useMemo(
    () =>
      allCategories.filter(
        (category) => category.isActive && category.type === type,
      ),
    [allCategories, type],
  );

  useEffect(() => {
    if (!user) return;
    void getWallets().then(setWallets);
    void ensureFinanceTimezone()
      .then(setTimezone)
      .catch(() => {});
  }, [user]);

  useEffect(() => {
    if (paramTransactionType) setType(paramTransactionType);
  }, [paramTransactionType]);

  useEffect(() => {
    if (paramCategoryId) setCategoryId(paramCategoryId);
  }, [paramCategoryId]);

  useEffect(() => {
    if (wallets.length === 0) {
      setWalletId('');
      return;
    }
    if (
      paramWalletId &&
      wallets.some((wallet) => wallet.id === paramWalletId)
    ) {
      setWalletId(paramWalletId);
    } else {
      setWalletId((current) =>
        wallets.some((wallet) => wallet.id === current)
          ? current
          : '',
      );
    }
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
  const selectedWalletCurrency = selectedWallet
    ? walletCurrency(selectedWallet)
    : null;
  const selectedCategory = categories.find(
    (category) => category.id === categoryId,
  );
  const sourceCurrency = selectedWallet
    ? (selectedWallet.currency ?? 'USD').toUpperCase()
    : null;
  const destinationWallets = useMemo(() => {
    const sourceWallet = wallets.find(
      (wallet) => wallet.id === walletId,
    );
    if (!sourceWallet) return [];

    const currency = walletCurrency(sourceWallet);
    return wallets.filter(
      (wallet) =>
        wallet.id !== walletId && walletCurrency(wallet) === currency,
    );
  }, [walletId, wallets]);

  useEffect(() => {
    setTransferToWalletId((current) => {
      if (
        destinationWallets.some((wallet) => wallet.id === current)
      ) {
        return current;
      }
      return '';
    });
  }, [destinationWallets]);
  const walletPickerItems = useMemo(
    () =>
      wallets.map((wallet) => ({
        id: wallet.id,
        name: wallet.name,
        currency: wallet.currency ?? 'USD',
        type: wallet.type,
        icon: wallet.icon,
        color: wallet.color,
        cardStyleId: wallet.cardStyleId,
      })),
    [wallets],
  );
  const categoryPickerItems = categories.map((category) => {
    const matchingBudget = selectedWalletCurrency
      ? budgetProgress.find(
          (budget) =>
            budget.categoryId === category.id &&
            budget.currency === selectedWalletCurrency,
        )
      : null;
    const budgetAmountMinor = matchingBudget?.budgetAmountMinor;
    const budgetUsage =
      matchingBudget &&
      budgetAmountMinor != null &&
      matchingBudget.percentage !== null
        ? `${formatMinorAmount(matchingBudget.spentMinor, matchingBudget.currency)} of ${formatMinorAmount(budgetAmountMinor, matchingBudget.currency)} used · ${Math.round(matchingBudget.percentage)}%`
        : undefined;

    return {
      id: category.id,
      name: category.name,
      icon: category.icon,
      color: category.color,
      budgetUsage,
    };
  });
  const categoryPickerItemsById = new Map(
    categoryPickerItems.map((category) => [category.id, category]),
  );
  const suggestedCategoryPickerItems = suggestedCategories.flatMap(
    (category) => {
      const matchingCategory = categoryPickerItemsById.get(category.id);
      return matchingCategory ? [matchingCategory] : [];
    },
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
        const hasCompatibleDestination = destinationWallets.some(
          (wallet) => wallet.id === transferToWalletId,
        );
        if (!hasCompatibleDestination) {
          Alert.alert(
            'Choose a matching wallet',
            'Transfers are available only between wallets that share the same currency.',
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
  const selectedWalletStyle = selectedWallet
    ? getWalletCardStyle(selectedWallet.cardStyleId)
    : null;
  const destinationWalletStyle = selectedDestination
    ? getWalletCardStyle(selectedDestination.cardStyleId)
    : null;
  const selectedWalletAccent =
    selectedWallet?.color ??
    selectedWalletStyle?.swatchHex ??
    tokens.primary;
  const destinationWalletAccent =
    selectedDestination?.color ??
    destinationWalletStyle?.swatchHex ??
    tokens.transfer;
  const categoryAccent =
    selectedCategory?.color ?? tokens.accents.lilac;
  const hasTransferDestination = destinationWallets.some(
    (wallet) => wallet.id === transferToWalletId,
  );
  const amountPrefix =
    type === 'income' ? '+' : type === 'expense' ? '−' : '';
  const amountTone =
    type === 'income'
      ? 'text-income'
      : type === 'expense'
        ? 'text-expense'
        : 'text-transfer';
  const currency = selectedWallet?.currency?.toUpperCase();

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

        <View className="flex-1 items-center justify-center px-2">
          <Text
            className={`mt-2 text-6xl font-bold tracking-tight ${amountTone}`}
            accessibilityLabel={`${amount || '0'}`}
          >
            {amountPrefix}
            {amount || '0'}
          </Text>
          <View className="mt-4 items-center">
            <Text className="text-sm font-bold text-foreground">
              {currency ?? 'Choose a wallet'}
            </Text>
          </View>
        </View>

        <View className="pt-2">
          <View className="mb-2 flex-row items-center justify-between px-1">
            <Text className="text-xs font-bold uppercase tracking-wide text-muted">
              Transaction details
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="More details"
              className="min-h-9 flex-row items-center rounded-full bg-surface-2 px-3 active:opacity-85"
              onPress={() => setDetailsVisible(true)}
            >
              <IconSymbol
                color={tokens.foreground}
                name="tune"
                size={16}
              />
              <Text className="ml-1 text-xs font-bold text-foreground">
                Details
              </Text>
            </Pressable>
          </View>

          <View className="mb-3 flex-row items-stretch gap-2">
            <TransactionModifierChip
              accessibilityLabel={
                isTransfer
                  ? `From wallet, ${selectedWallet?.name ?? 'not selected'}`
                  : `Paid from, ${selectedWallet?.name ?? 'not selected'}`
              }
              value={selectedWallet?.name ?? ''}
              hint={isTransfer ? 'From wallet' : 'Wallet'}
              accentColor={selectedWalletAccent}
              leading={
                selectedWallet ? (
                  <WalletIcon
                    color={
                      selectedWalletStyle?.contentColor ??
                      tokens.foreground
                    }
                    icon={selectedWallet.icon}
                    size={20}
                    type={selectedWallet.type}
                  />
                ) : undefined
              }
              onPress={() => setWalletPickerVisible(true)}
            />

            {isTransfer ? (
              <>
                <View className="w-7 items-center justify-center">
                  <IconSymbol
                    color={tokens.transfer}
                    name="arrow-right"
                    size={22}
                  />
                </View>
                <TransactionModifierChip
                  accessibilityLabel={`Move to, ${selectedDestination?.name ?? 'not selected'}`}
                  value={selectedDestination?.name ?? ''}
                  hint="To wallet"
                  accentColor={destinationWalletAccent}
                  leading={
                    selectedDestination ? (
                      <WalletIcon
                        color={
                          destinationWalletStyle?.contentColor ??
                          tokens.foreground
                        }
                        icon={selectedDestination.icon}
                        size={20}
                        type={selectedDestination.type}
                      />
                    ) : undefined
                  }
                  onPress={() => setDestinationPickerVisible(true)}
                />
              </>
            ) : (
              <TransactionModifierChip
                accessibilityLabel={`Category, ${selectedCategory?.name ?? 'not selected'}`}
                value={selectedCategory?.name ?? ''}
                hint="Category"
                accentColor={categoryAccent}
                leading={
                  selectedCategory ? (
                    <CategoryIcon
                      color={tokens.foreground}
                      icon={selectedCategory.icon}
                      size={20}
                    />
                  ) : undefined
                }
                onPress={() => setCategoryPickerVisible(true)}
              />
            )}
          </View>

          <NumericKeypad onKeyPress={handleKeyPress} />
          <PrimaryButton
            className="mt-3"
            disabled={
              !walletId || (isTransfer && !hasTransferDestination)
            }
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
        onClose={() => setWalletPickerVisible(false)}
        onSelect={(wallet) => setWalletId(wallet.id)}
      />

      <WalletPickerModal
        visible={destinationPickerVisible}
        wallets={destinationWallets.map((wallet) => ({
          id: wallet.id,
          name: wallet.name,
          currency: wallet.currency ?? 'USD',
          type: wallet.type,
          icon: wallet.icon,
          color: wallet.color,
          cardStyleId: wallet.cardStyleId,
        }))}
        selectedId={transferToWalletId}
        title="Move to"
        emptyMessage={
          sourceCurrency
            ? `No other ${sourceCurrency} wallets are available. Transfers require two wallets with the same currency.`
            : 'Choose a source wallet first.'
        }
        onClose={() => setDestinationPickerVisible(false)}
        onSelect={(wallet) => setTransferToWalletId(wallet.id)}
      />

      <CategoryPickerModal
        visible={categoryPickerVisible}
        categories={categoryPickerItems}
        suggested={
          type === 'expense' ? suggestedCategoryPickerItems : []
        }
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
