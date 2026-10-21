import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, TextInput, View } from 'react-native';
import { Text } from '@/components/ui/text';
import { router, useLocalSearchParams } from 'expo-router';
import { useValue } from '@legendapp/state/react';
import { createTransactionSchema } from '@repo/types';

import { CategoryIcon } from '@/components/categories/category-icon';
import { NumericKeypad } from '@/components/ui/numeric-keypad';
import { PickerField } from '@/components/ui/picker-field';
import { Segmented } from '@/components/ui/segmented';
import { WalletIcon } from '@/components/wallets/wallet-icon';
import { getWalletCardStyle } from '@/constants/wallet-card-styles';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { useAuth } from '@/lib/auth/auth-context';
import { dayLabel, formatDay } from '@/lib/dates/day-label';
import {
  localDateInputToIso,
  toLocalDateInput,
} from '@/lib/dates/local-date-input';
import {
  budgetProgress$,
  categoriesForUser$,
  recentExpenseCategories$,
} from '@/lib/finance/selectors';
import { formatMoney } from '@/lib/finance/format-money';
import { parseAmountInput } from '@/lib/finance/money';
import { findDuplicate } from '@/lib/ai/duplicates';
import { ensureFinanceTimezone } from '@/lib/supabase/profile';
import { getLedgerEntries } from '@/lib/supabase/proposed-transactions';
import {
  createTransaction,
  createTransfer,
} from '@/lib/supabase/transactions';
import { getWallets } from '@/lib/supabase/wallets';
import { toCategoryTiles } from '@/lib/sheet/category-tiles';
import {
  openSheet,
  type WalletOption,
} from '@/lib/sheet/sheet-store';
import { useMainCurrency } from '@/lib/finance/main-currency';
import {
  prefetchTransactionLocation,
  type TransactionLocationSnapshot,
} from '@/lib/transactions/prefetch-location';
import { Button } from '@/components/ui/button';
import { tid } from '@/lib/test-ids';
import { Page } from '@/components/ui/page';

const MAX_AMOUNT_LENGTH = 12;

type Wallet = Awaited<ReturnType<typeof getWallets>>[number];
type TransactionKind = 'income' | 'expense' | 'transfer';

type Details = {
  merchant: string;
  description: string;
  /** Local YYYY-MM-DD. */
  transactionDate: string;
  locationSnapshot: TransactionLocationSnapshot | null;
};

function toWalletOption(wallet: Wallet): WalletOption {
  return {
    id: wallet.id,
    name: wallet.name,
    currency: wallet.currency ?? 'USD',
    type: wallet.type,
    icon: wallet.icon,
    color: wallet.color,
    cardStyleId: wallet.cardStyleId,
  };
}

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
  const tokens = useThemeTokens();
  const mainCurrency = useMainCurrency();
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
  const [details, setDetails] = useState<Details>(() => ({
    merchant: '',
    description: '',
    transactionDate: toLocalDateInput(new Date()),
    locationSnapshot: null,
  }));

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
    if (type === 'transfer') return;

    let cancelled = false;
    void prefetchTransactionLocation().then((snapshot) => {
      if (cancelled || !snapshot) return;
      setDetails((current) => ({
        ...current,
        locationSnapshot: snapshot,
      }));
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
  const categoryCurrency = selectedWalletCurrency ?? mainCurrency;

  const pickWallet = async (role: 'source' | 'destination') => {
    const destination = role === 'destination';
    const pick = await openSheet({
      kind: 'wallet',
      title: destination
        ? 'Move to'
        : isTransfer
          ? 'From wallet'
          : 'Paid from',
      wallets: (destination ? destinationWallets : wallets).map(
        toWalletOption,
      ),
      selectedId: destination
        ? transferToWalletId || null
        : walletId || null,
      emptyMessage: destination
        ? sourceCurrency
          ? `No other ${sourceCurrency} wallet yet. Transfers need two wallets in the same currency.`
          : 'Choose a source wallet first.'
        : undefined,
    });
    if (!pick?.walletId) return;
    if (destination) setTransferToWalletId(pick.walletId);
    else setWalletId(pick.walletId);
  };

  const pickCategory = async () => {
    const picked = await openSheet({
      kind: 'category',
      title: 'Choose category',
      currency: categoryCurrency,
      categories: toCategoryTiles(
        categories,
        budgetProgress,
        categoryCurrency,
        type === 'expense'
          ? suggestedCategories.map((category) => category.id)
          : [],
      ),
      selectedId: categoryId || null,
      onCreate: () =>
        router.push({
          pathname: '/categories/form',
          params: { type, returnTo: '/transaction/new' },
        } as never),
    });
    if (picked) setCategoryId(picked);
  };

  const pickDate = async () => {
    const picked = await openSheet({
      kind: 'date',
      selected: details.transactionDate,
    });
    if (picked)
      setDetails((current) => ({
        ...current,
        transactionDate: picked,
      }));
  };

  const handleKeyPress = useCallback((key: string) => {
    setAmount((previous) => {
      if (key === '⌫') return previous.slice(0, -1);
      if (key === '.' && previous.includes('.')) return previous;
      if (previous.length >= MAX_AMOUNT_LENGTH) return previous;
      if (key === '.' && previous.length === 0) return '0.';
      return previous + key;
    });
  }, []);

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
        await createTransfer(
          {
            fromWalletId: walletId,
            toWalletId: transferToWalletId,
            amountMinor,
            description: details.description.trim() || null,
          },
          'manual',
        );
      } else {
        // The form has no time field: keep the real time when the date is left as today,
        // so duplicate and routine matching can line it up with the bank notification.
        const transactionDate =
          details.transactionDate === toLocalDateInput(new Date())
            ? new Date().toISOString()
            : (localDateInputToIso(details.transactionDate) ??
              new Date().toISOString());
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
        const duplicate = findDuplicate(
          {
            id: 'draft',
            kind: 'transaction',
            type,
            walletId,
            currency: selectedWalletCurrency ?? 'USD',
            amountMinor,
            merchant: parsed.data.merchant ?? null,
            at: transactionDate,
          },
          await getLedgerEntries(),
        );
        if (
          duplicate?.kind === 'same_purchase' &&
          !(await openSheet({
            kind: 'confirm',
            title: 'Maybe a duplicate',
            message: `You already have ${[duplicate.target.merchant, formatMoney(amountMinor, selectedWalletCurrency ?? 'USD')].filter(Boolean).join(' ')} on ${formatDay(duplicate.target.at)}.`,
            confirmLabel: 'Add mine anyway',
            cancelLabel: 'Change it',
          }))
        ) {
          return;
        }
        await createTransaction(parsed.data, 'manual');
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
    <Page
      screen="capture"
      kind="pushed"
      title="New transaction"
    >
      <View
        className="flex-1 px-5"
        style={{ paddingBottom: 12 }}
      >
        <View className="mt-3">
          <Segmented
            screen="capture"
            name="set-type"
            accessibilityLabel="Transaction type"
            options={(['expense', 'income', 'transfer'] as const).map(
              (option) => ({
                value: option,
                label: transactionCopy[option],
              }),
            )}
            value={type}
            onChange={setType}
          />
        </View>

        <View className="flex-1 items-center justify-center px-2">
          <Text
            className={`mt-2 text-6xl font-display-bold tracking-tight ${amountTone}`}
            accessibilityLabel={`${amount || '0'}`}
          >
            {amountPrefix}
            {amount || '0'}
          </Text>
          <View className="mt-4 items-center">
            <Text className="text-sm font-display-bold text-foreground">
              {currency ?? 'Choose a wallet'}
            </Text>
          </View>
        </View>

        <View className="gap-2 pt-2">
          <View className="flex-row gap-2">
            <PickerField
              testID={tid('capture', 'wallet')}
              className="flex-1"
              label={isTransfer ? 'From wallet' : 'Paid from'}
              value={selectedWallet?.name ?? ''}
              leading={
                selectedWallet ? (
                  <View
                    className="h-8 w-8 items-center justify-center rounded-full"
                    style={{ backgroundColor: selectedWalletAccent }}
                  >
                    <WalletIcon
                      color={
                        selectedWalletStyle?.contentColor ??
                        tokens.foreground
                      }
                      icon={selectedWallet.icon}
                      size={18}
                      type={selectedWallet.type}
                    />
                  </View>
                ) : undefined
              }
              onPress={() => void pickWallet('source')}
            />
            {isTransfer ? (
              <PickerField
                testID={tid('capture', 'destination')}
                className="flex-1"
                label="Move to"
                value={selectedDestination?.name ?? ''}
                leading={
                  selectedDestination ? (
                    <View
                      className="h-8 w-8 items-center justify-center rounded-full"
                      style={{
                        backgroundColor: destinationWalletAccent,
                      }}
                    >
                      <WalletIcon
                        color={
                          destinationWalletStyle?.contentColor ??
                          tokens.foreground
                        }
                        icon={selectedDestination.icon}
                        size={18}
                        type={selectedDestination.type}
                      />
                    </View>
                  ) : undefined
                }
                onPress={() => void pickWallet('destination')}
              />
            ) : (
              <PickerField
                testID={tid('capture', 'category')}
                className="flex-1"
                label="Category"
                value={selectedCategory?.name ?? ''}
                leading={
                  selectedCategory ? (
                    <View
                      className="h-8 w-8 items-center justify-center rounded-full"
                      style={{ backgroundColor: categoryAccent }}
                    >
                      <CategoryIcon
                        color={tokens.onPastel}
                        icon={selectedCategory.icon}
                        size={18}
                      />
                    </View>
                  ) : undefined
                }
                onPress={() => void pickCategory()}
              />
            )}
          </View>

          <View className="flex-row gap-2">
            <View className="h-16 flex-1 justify-center rounded-field bg-sand px-3.5">
              <Text className="text-[13px] leading-[18px] text-muted">
                {isTransfer ? 'Note' : 'Shop or note'}
              </Text>
              <TextInput
                testID={tid(
                  'capture',
                  isTransfer ? 'note' : 'merchant',
                )}
                accessibilityLabel={
                  isTransfer ? 'Note' : 'Shop or note'
                }
                autoCapitalize="words"
                className="p-0 text-base font-display-semibold text-foreground"
                placeholder="Optional"
                placeholderTextColor={tokens.muted}
                value={
                  isTransfer ? details.description : details.merchant
                }
                onChangeText={(text) =>
                  setDetails((current) =>
                    isTransfer
                      ? { ...current, description: text }
                      : { ...current, merchant: text },
                  )
                }
              />
            </View>
            {isTransfer ? null : (
              <PickerField
                testID={tid('capture', 'date')}
                className="w-36"
                label="Date"
                value={dayLabel(details.transactionDate)}
                onPress={() => void pickDate()}
              />
            )}
          </View>

          <NumericKeypad onKeyPress={handleKeyPress} />
          <Button
            testID={tid('capture', 'submit')}
            className="mt-1"
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
    </Page>
  );
}
