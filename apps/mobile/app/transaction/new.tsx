import { useValue } from '@legendapp/state/react';
import { createTransactionSchema, type MinorAmount } from '@repo/types';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, TextInput, View } from 'react-native';

import { AmountPage } from '@/components/capture/amount-page';
import {
  DuplicateSheet,
  type DuplicateHit,
} from '@/components/capture/duplicate-sheet';
import { FieldBubble } from '@/components/capture/field-bubble';
import { CategoryIcon } from '@/components/categories/category-icon';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { PickerField } from '@/components/ui/picker-field';
import { Segmented } from '@/components/ui/segmented';
import { Text } from '@/components/ui/text';
import { WalletIcon } from '@/components/wallets/wallet-icon';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import type { LedgerEntry } from '@/lib/ai/duplicates';
import { useAuth } from '@/lib/auth/auth-context';
import { readAmount } from '@/lib/capture/amount-input';
import { amountSentence } from '@/lib/capture/amount-sentence';
import {
  duplicateCopy,
  findTypedDuplicate,
} from '@/lib/capture/type-duplicate';
import { dayLabel } from '@/lib/dates/day-label';
import {
  localDateInputToIso,
  toLocalDateInput,
} from '@/lib/dates/local-date-input';
import { useMainCurrency } from '@/lib/finance/main-currency';
import {
  budgetProgress$,
  categoriesForUser$,
  recentExpenseCategories$,
  transactions$,
  walletsForUser$,
} from '@/lib/finance/selectors';
import { financeProjection$ } from '@/lib/finance/projection';
import type { FinanceWallet } from '@/lib/finance/types';
import { approve } from '@/lib/haptics';
import { toCategoryTiles } from '@/lib/sheet/category-tiles';
import { openSheet, type WalletOption } from '@/lib/sheet/sheet-store';
import { ensureFinanceTimezone } from '@/lib/supabase/profile';
import { getLedgerEntries } from '@/lib/supabase/proposed-transactions';
import {
  createTransaction,
  createTransfer,
} from '@/lib/supabase/transactions';
import { tid } from '@/lib/test-ids';
import {
  prefetchTransactionLocation,
  type TransactionLocationSnapshot,
} from '@/lib/transactions/prefetch-location';
import { proposalRow, transactionRow } from '@/lib/transactions/row';
import { resolveDefaultWalletId } from '@/lib/wallets/default-wallet';

type Kind = 'expense' | 'income' | 'transfer';

const COPY: Record<Kind, { tab: string; title: string; save: string }> = {
  expense: { tab: 'Expense', title: 'New expense', save: 'Add expense' },
  income: { tab: 'Income', title: 'New income', save: 'Add income' },
  transfer: {
    tab: 'Transfer',
    title: 'New transfer',
    save: 'Add transfer',
  },
};

const KINDS = ['expense', 'income', 'transfer'] as const;

const first = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

function walletOption(wallet: FinanceWallet): WalletOption {
  return {
    id: wallet.id,
    name: wallet.name,
    currency: wallet.currency,
    type: wallet.type,
    icon: wallet.icon,
    color: wallet.color,
    cardStyleId: wallet.cardStyleId,
  };
}

/** V2A-CaptureType: Type it, the amount page for a new expense, income or transfer. */
export default function TypeItScreen() {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const tokens = useThemeTokens();
  const mainCurrency = useMainCurrency();
  const params = useLocalSearchParams<{
    walletId?: string | string[];
    type?: string | string[];
    categoryId?: string | string[];
  }>();
  const paramType = first(params.type);

  const [kind, setKind] = useState<Kind>(
    paramType === 'income' ? 'income' : 'expense',
  );
  const [typed, setTyped] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(
    first(params.categoryId) ?? null,
  );
  const [walletId, setWalletId] = useState<string | null>(null);
  const [toWalletId, setToWalletId] = useState<string | null>(null);
  const [date, setDate] = useState(() => toLocalDateInput(new Date()));
  const [note, setNote] = useState('');
  const [location, setLocation] =
    useState<TransactionLocationSnapshot | null>(null);
  const [timezone, setTimezone] = useState('UTC');
  const [saving, setSaving] = useState(false);
  const [duplicate, setDuplicate] = useState<{
    hit: DuplicateHit;
    targetId: string;
    targetKind: LedgerEntry['kind'];
    open: boolean;
  } | null>(null);

  const allWallets = useValue(walletsForUser$(userId));
  const allCategories = useValue(categoriesForUser$(userId));
  const recentCategories = useValue(recentExpenseCategories$(userId));
  const budgetProgress = useValue(budgetProgress$(userId, timezone));
  const transactions = useValue(transactions$({ userId }));

  const wallets = useMemo(
    () => allWallets.filter((wallet) => wallet.currency === mainCurrency),
    [allWallets, mainCurrency],
  );
  const categories = useMemo(
    () =>
      allCategories.filter(
        (category) => category.isActive && category.type === kind,
      ),
    [allCategories, kind],
  );
  const wallet = wallets.find((item) => item.id === walletId) ?? null;
  const toWallet =
    wallets.find((item) => item.id === toWalletId && item.id !== walletId) ??
    null;
  const category =
    categories.find((item) => item.id === categoryId) ?? null;
  const amount = readAmount(typed);

  useEffect(() => {
    void ensureFinanceTimezone()
      .then(setTimezone)
      .catch(() => {});
    void prefetchTransactionLocation().then(setLocation);
  }, []);

  useEffect(() => {
    if (walletId && wallets.some((item) => item.id === walletId)) return;
    const asked = first(params.walletId);
    setWalletId(
      (asked && wallets.some((item) => item.id === asked) ? asked : null) ??
        resolveDefaultWalletId(wallets) ??
        wallets[0]?.id ??
        null,
    );
  }, [params.walletId, walletId, wallets]);

  useEffect(() => {
    if (categoryId || kind !== 'expense') return;
    const recent = recentCategories[0]?.id;
    if (recent) setCategoryId(recent);
  }, [categoryId, kind, recentCategories]);

  const sentence = useMemo(() => {
    if (kind === 'transfer') {
      return amountSentence({ kind, currency: mainCurrency });
    }
    if (kind === 'income') {
      const month = date.slice(0, 7);
      const incomeThisMonthMinor = transactions
        .filter(
          (row) =>
            row.type === 'income' &&
            row.currency === mainCurrency &&
            toLocalDateInput(new Date(row.transactionDate)).startsWith(month),
        )
        .reduce((sum, row) => sum + row.amountMinor, 0) as MinorAmount;
      return amountSentence({
        kind,
        amountMinor: amount.minor,
        currency: mainCurrency,
        incomeThisMonthMinor,
      });
    }
    const progress = budgetProgress.find(
      (row) =>
        row.categoryId === category?.id && row.currency === mainCurrency,
    );
    return amountSentence({
      kind,
      amountMinor: amount.minor,
      currency: mainCurrency,
      category: category
        ? {
            name: category.name,
            budgetMinor: progress?.budgetAmountMinor ?? null,
            spentMinor: progress?.spentMinor ?? (0 as MinorAmount),
          }
        : null,
    });
  }, [
    amount.minor,
    budgetProgress,
    category,
    date,
    kind,
    mainCurrency,
    transactions,
  ]);

  const changeKind = (next: Kind) => {
    setKind(next);
    setCategoryId(null);
  };

  const pickWallet = async (role: 'from' | 'to') => {
    const picked = await openSheet({
      kind: 'wallet',
      title:
        role === 'to'
          ? 'To'
          : kind === 'transfer'
            ? 'From'
            : kind === 'income'
              ? 'Paid into'
              : 'Paid with',
      wallets: wallets
        .filter((item) => role === 'from' || item.id !== walletId)
        .map(walletOption),
      selectedId: role === 'to' ? toWalletId : walletId,
      emptyMessage:
        role === 'to'
          ? 'Transfers need a second wallet in your main currency.'
          : undefined,
    });
    if (!picked?.walletId) return;
    if (role === 'to') setToWalletId(picked.walletId);
    else setWalletId(picked.walletId);
  };

  const pickCategory = async () => {
    const picked = await openSheet({
      kind: 'category',
      title: 'Choose category',
      currency: mainCurrency,
      categories: toCategoryTiles(
        categories,
        budgetProgress,
        mainCurrency,
        kind === 'expense' ? recentCategories.map((item) => item.id) : [],
      ),
      selectedId: categoryId,
      onCreate: () =>
        router.push({
          pathname: '/categories/form',
          params: { type: kind, returnTo: '/transaction/new' },
        }),
    });
    if (picked) setCategoryId(picked);
  };

  const pickDate = async () => {
    const picked = await openSheet({ kind: 'date', selected: date });
    if (picked) setDate(picked);
  };

  /** The page has no time field: today keeps the real time, so duplicates line up with alerts. */
  const transactionDate =
    date === toLocalDateInput(new Date())
      ? new Date().toISOString()
      : (localDateInputToIso(date) ?? new Date().toISOString());

  const findRepeat = async (): Promise<boolean> => {
    if (!wallet || kind === 'transfer') return false;
    const target = findTypedDuplicate(
      {
        id: 'draft',
        kind: 'transaction',
        type: kind,
        walletId: wallet.id,
        currency: wallet.currency,
        amountMinor: amount.minor,
        merchant: note.trim() || null,
        at: transactionDate,
      },
      await getLedgerEntries(),
    );
    if (!target) return false;
    const projection = financeProjection$.get();
    const lookups = {
      categoriesById: projection.categoriesById,
      walletNames: Object.fromEntries(
        allWallets.map((item) => [item.id, item.name]),
      ),
    };
    const proposal =
      target.kind === 'proposal' ? projection.proposalsById[target.id] : null;
    const saved =
      target.kind === 'transaction'
        ? projection.transactionsById[target.id]
        : null;
    const row = proposal
      ? proposalRow(proposal, lookups)
      : saved
        ? transactionRow(saved, lookups)
        : null;
    if (!row) return false;
    const copy = duplicateCopy({
      kind: target.kind,
      amountMinor: amount.minor,
      currency: wallet.currency,
      merchant: target.merchant,
      at: target.at,
      walletName: target.walletId
        ? (lookups.walletNames[target.walletId] ?? null)
        : null,
      fromNotification: proposal?.sourceType === 'notification',
    });
    setDuplicate({
      hit: { ...copy, row },
      targetId: target.id,
      targetKind: target.kind,
      open: true,
    });
    return true;
  };

  const save = async ({ checkRepeat }: { checkRepeat: boolean }) => {
    if (!wallet || amount.minor <= 0) return;
    setSaving(true);
    try {
      if (kind === 'transfer') {
        if (!toWallet) return;
        await createTransfer(
          {
            fromWalletId: wallet.id,
            toWalletId: toWallet.id,
            amountMinor: amount.minor,
            description: note.trim() || null,
            transactionDate,
          },
          'manual',
        );
      } else {
        const parsed = createTransactionSchema.safeParse({
          walletId: wallet.id,
          amountMinor: amount.minor,
          type: kind,
          categoryId: category?.id ?? null,
          merchant: note.trim() || null,
          transactionDate,
          ...(location
            ? {
                locationLatitude: location.latitude,
                locationLongitude: location.longitude,
                locationName: location.name,
              }
            : {}),
        });
        if (!parsed.success) {
          Alert.alert(
            'Check this transaction',
            parsed.error.errors[0]?.message ?? 'Enter valid details.',
          );
          return;
        }
        if (checkRepeat && (await findRepeat())) return;
        await createTransaction(parsed.data, 'manual');
      }
      approve();
      router.back();
    } catch (error) {
      Alert.alert(
        'Could not add this',
        error instanceof Error ? error.message : 'Please try again.',
      );
    } finally {
      setSaving(false);
    }
  };

  const closeDuplicate = () =>
    setDuplicate((current) => current && { ...current, open: false });

  const walletBubble = (item: FinanceWallet | null) =>
    item ? (
      <FieldBubble color={item.color ?? tokens.card}>
        <WalletIcon
          icon={item.icon}
          type={item.type}
          size={18}
          color={tokens.onPastel}
        />
      </FieldBubble>
    ) : undefined;

  const dateField = (
    <PickerField
      testID={tid('capture', 'date')}
      className="flex-1"
      label="Date"
      value={dayLabel(date)}
      leading={
        <FieldBubble color={tokens.card}>
          <IconSymbol
            name="calendar-blank-outline"
            size={18}
            color={tokens.foreground}
          />
        </FieldBubble>
      }
      onPress={() => void pickDate()}
    />
  );

  const noteField = (
    <View className="h-16 flex-1 flex-row items-center gap-2.5 rounded-field bg-sand px-3.5">
      <FieldBubble color={tokens.card}>
        <IconSymbol
          name="pencil-outline"
          size={18}
          color={tokens.foreground}
        />
      </FieldBubble>
      <View className="min-w-0 flex-1">
        <Text className="text-[13px] leading-[18px] text-muted">
          Shop or note
        </Text>
        <TextInput
          testID={tid('capture', 'note')}
          accessibilityLabel="Shop or note"
          autoCapitalize="words"
          className="p-0 text-base leading-[22px] font-display-semibold text-foreground"
          placeholder="Optional"
          placeholderTextColor={tokens.muted}
          value={note}
          onChangeText={setNote}
        />
      </View>
    </View>
  );

  const ready =
    amount.minor > 0 && !!wallet && (kind !== 'transfer' || !!toWallet);

  return (
    <>
      <AmountPage
        screen="capture"
        header="task"
        title={COPY[kind].title}
        typed={typed}
        onTyped={setTyped}
        currency={wallet?.currency ?? mainCurrency}
        direction={kind === 'transfer' ? 'neutral' : kind}
        sentence={sentence}
        control={
          <Segmented
            screen="capture"
            name="type"
            accessibilityLabel="Transaction type"
            options={KINDS.map((value) => ({
              value,
              label: COPY[value].tab,
            }))}
            value={kind}
            onChange={changeKind}
          />
        }
        action={{
          label: COPY[kind].save,
          onPress: () => void save({ checkRepeat: true }),
          loading: saving,
          loadingLabel: 'Saving',
          disabled: !ready,
        }}
      >
        {kind === 'transfer' ? (
          <>
            <PickerField
              testID={tid('capture', 'wallet')}
              label="From"
              value={wallet?.name ?? ''}
              leading={walletBubble(wallet)}
              onPress={() => void pickWallet('from')}
            />
            <PickerField
              testID={tid('capture', 'to-wallet')}
              label="To"
              value={toWallet?.name ?? ''}
              leading={walletBubble(toWallet)}
              onPress={() => void pickWallet('to')}
            />
            <View className="flex-row gap-2">
              {dateField}
              {noteField}
            </View>
          </>
        ) : (
          <>
            <PickerField
              testID={tid('capture', 'category')}
              label="Category"
              value={category?.name ?? ''}
              leading={
                category ? (
                  <FieldBubble color={category.color ?? tokens.card}>
                    <CategoryIcon
                      icon={category.icon}
                      size={18}
                      color={tokens.onPastel}
                    />
                  </FieldBubble>
                ) : undefined
              }
              onPress={() => void pickCategory()}
            />
            <View className="flex-row gap-2">
              <PickerField
                testID={tid('capture', 'wallet')}
                className="flex-1"
                label={kind === 'income' ? 'Into' : 'Paid with'}
                value={wallet?.name ?? ''}
                leading={walletBubble(wallet)}
                onPress={() => void pickWallet('from')}
              />
              {dateField}
            </View>
            {noteField}
          </>
        )}
      </AmountPage>
      {duplicate ? (
        <DuplicateSheet
          hit={duplicate.hit}
          open={duplicate.open}
          onDismiss={closeDuplicate}
          onExited={() => setDuplicate(null)}
          onReview={() => {
            closeDuplicate();
            router.replace(
              duplicate.targetKind === 'proposal'
                ? {
                    pathname: '/proposal/[id]',
                    params: { id: duplicate.targetId },
                  }
                : {
                    pathname: '/transaction/[id]',
                    params: { id: duplicate.targetId },
                  },
            );
          }}
          onAddAnyway={() => {
            closeDuplicate();
            void save({ checkRepeat: false });
          }}
          onChangeAmount={() => {
            closeDuplicate();
            setTyped('');
          }}
        />
      ) : null}
    </>
  );
}
