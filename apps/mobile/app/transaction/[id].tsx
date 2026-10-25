import { useValue } from '@legendapp/state/react';
import type { UpdateTransaction } from '@repo/types';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Alert, ScrollView, View } from 'react-native';

import { BudgetLine } from '@/components/transaction/budget-line';
import {
  DetailLinks,
  MapThumb,
  useReceiptLink,
  type DetailLink,
} from '@/components/transaction/detail-links';
import {
  DetailTiles,
  sourceIcon,
  sourceLabel,
  transactionSource,
  type Tile,
} from '@/components/transaction/detail-tiles';
import { Button } from '@/components/ui/button';
import { NotFound } from '@/components/ui/empty-tile';
import { IconSymbol } from '@/components/ui/icon-symbol';
import {
  InPlaceField,
  InPlaceGroup,
  type Saved,
} from '@/components/ui/in-place-field';
import { Page } from '@/components/ui/page';
import { Press } from '@/components/ui/press';
import { Text } from '@/components/ui/text';
import { TintBubble } from '@/components/ui/transaction-row';
import { useAuth } from '@/lib/auth/auth-context';
import { merchantKey } from '@/lib/ai/routine';
import { formatDate } from '@/lib/dates/day-label';
import { toLocalDateInput } from '@/lib/dates/local-date-input';
import {
  currencySymbol,
  formatMoney,
  formatSignedMoney,
} from '@/lib/finance/format-money';
import { merchantName } from '@/lib/finance/merchant-name';
import { groupPlaces, placeLabel } from '@/lib/finance/places';
import {
  budgetProgress$,
  categoriesForUser$,
  transactionById$,
  transactions$,
  walletsForUser$,
} from '@/lib/finance/selectors';
import type { FinanceTransaction } from '@/lib/finance/types';
import { toCategoryTiles } from '@/lib/sheet/category-tiles';
import { openSheet } from '@/lib/sheet/sheet-store';
import { transactions$ as transactionTable$ } from '@/lib/store';
import {
  listMerchantAliases,
  nameMerchant,
} from '@/lib/supabase/merchant-aliases';
import { ensureFinanceTimezone } from '@/lib/supabase/profile';
import {
  deleteTransaction,
  updateTransaction,
} from '@/lib/supabase/transactions';
import { tid, type TestId } from '@/lib/test-ids';
import { showToast } from '@/lib/toast/toast-store';
import { resolveTransactionIcon } from '@/lib/transactions/icon';
import { BALANCE_CORRECTION_TITLE } from '@/lib/wallets/balance-correction';
import { useThemeTokens } from '@/hooks/use-theme-tokens';

type RawRow = {
  metadata?: unknown;
  receipt_image_url?: string | null;
};

function clockTime(value: string): string {
  const date = new Date(value);
  const hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours % 12 || 12}:${minutes} ${hours < 12 ? 'am' : 'pm'}`;
}

function notSaved(error: unknown) {
  Alert.alert(
    'Not saved',
    error instanceof Error ? error.message : 'Try again.',
  );
}

async function update(
  id: string,
  change: UpdateTransaction,
  previous: UpdateTransaction,
): Promise<Saved> {
  await updateTransaction(id, change);
  return { undo: () => void updateTransaction(id, previous).catch(notSaved) };
}

function saveWithUndo(
  id: string,
  label: string,
  change: UpdateTransaction,
  previous: UpdateTransaction,
) {
  update(id, change, previous)
    .then(({ undo }) => showToast({ text: `${label} saved`, undo }))
    .catch(notSaved);
}

export default function TransactionDetailScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const id = params.id;
  const transaction = useValue(transactionById$(id));
  return transaction ? (
    <Detail transaction={transaction} />
  ) : (
    <Page
      screen="txn"
      kind="pushed"
      title="Transaction"
    >
      <NotFound
        icon="receipt-text-remove-outline"
        title="This spend isn't here any more"
        body="It was deleted here or on another device."
      />
    </Page>
  );
}

function Detail({ transaction: tx }: { transaction: FinanceTransaction }) {
  const { user } = useAuth();
  const tokens = useThemeTokens();
  const userId = user?.id ?? null;
  const wallets = useValue(walletsForUser$(userId));
  const categories = useValue(categoriesForUser$(userId));
  const all = useValue(transactions$({ userId }));
  const aliases = useValue(() =>
    userId ? listMerchantAliases(userId) : [],
  );
  const raw = useValue(
    () => transactionTable$[tx.id].get() as RawRow | undefined,
  );
  const [timezone, setTimezone] = useState('UTC');
  const [editing, setEditing] = useState<TestId | null>(null);
  const progress = useValue(budgetProgress$(userId, timezone));

  useEffect(() => {
    void ensureFinanceTimezone()
      .then(setTimezone)
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (tx.debtActivityId) router.dismissTo('/debts');
  }, [tx.debtActivityId]);

  const source = transactionSource(raw?.metadata);
  const category = categories.find((c) => c.id === tx.categoryId) ?? null;
  const wallet = wallets.find((w) => w.id === tx.walletId) ?? null;
  const toWallet =
    wallets.find((w) => w.id === tx.transferToWalletId) ?? null;
  const transfer = tx.type === 'transfer';
  const alert = source === 'notification' && tx.merchant !== null;
  const correction = tx.balanceCorrection;
  const title = correction
    ? BALANCE_CORRECTION_TITLE
    : transfer
    ? (tx.description ?? 'Transfer')
    : (merchantName(tx.merchant, aliases) ??
      tx.description ??
      category?.name ??
      'Transaction');
  const sign = tx.type === 'expense' ? '−' : tx.type === 'income' ? '+' : '';
  const thisMonth =
    toLocalDateInput(new Date(tx.transactionDate)).slice(0, 7) ===
    toLocalDateInput(new Date()).slice(0, 7);
  const budget =
    !transfer && thisMonth
      ? progress.find(
          (row) =>
            row.categoryId === tx.categoryId &&
            row.currency === tx.currency &&
            row.budgetAmountMinor !== null,
        )
      : undefined;
  const monthOf = (iso: string) => toLocalDateInput(new Date(iso)).slice(0, 7);
  const sameMerchant = useMemo(() => {
    if (!tx.merchant || transfer) return [];
    const month = monthOf(tx.transactionDate);
    const key = tx.merchant.toLowerCase();
    return all.filter(
      (row) =>
        row.merchant?.toLowerCase() === key &&
        row.currency === tx.currency &&
        row.type === tx.type &&
        monthOf(row.transactionDate) === month,
    );
  }, [all, tx, transfer]);
  const place = useMemo(
    () =>
      tx.locationLatitude === null
        ? null
        : (groupPlaces(all, { currency: tx.currency }).find((candidate) =>
            candidate.transactions.some((row) => row.id === tx.id),
          ) ?? null),
    [all, tx.id, tx.currency, tx.locationLatitude],
  );
  const label = place ?? placeLabel(tx.locationName);
  const receipt = useReceiptLink(
    tx.id,
    userId,
    raw?.receipt_image_url ?? null,
  );

  const sameCurrencyWallets = (exclude?: string | null) =>
    wallets
      .filter((w) => w.currency === tx.currency && w.id !== exclude)
      .map((w) => ({
        id: w.id,
        name: w.name,
        currency: w.currency,
        type: w.type,
        icon: w.icon,
        color: w.color,
        cardStyleId: w.cardStyleId,
      }));

  const saveName = async (next: string): Promise<Saved | void> => {
    if (next === title) return;
    const key = alert ? merchantKey(tx.merchant) : null;
    if (key) {
      const previous = title;
      await nameMerchant(key, next);
      return { undo: () => void nameMerchant(key, previous).catch(notSaved) };
    }
    return transfer
      ? update(tx.id, { description: next }, { description: tx.description })
      : update(tx.id, { merchant: next }, { merchant: tx.merchant });
  };

  const pickCategory = async () => {
    const type = tx.type === 'income' ? 'income' : 'expense';
    const picked = await openSheet({
      kind: 'category',
      title: 'Choose category',
      currency: tx.currency,
      categories: toCategoryTiles(
        categories.filter((c) => c.isActive && c.type === type),
        progress,
        tx.currency,
      ),
      selectedId: tx.categoryId,
      onCreate: () =>
        router.push({ pathname: '/categories/form', params: { type } }),
    });
    if (picked && picked !== tx.categoryId)
      saveWithUndo(
        tx.id,
        'Category',
        { categoryId: picked },
        { categoryId: tx.categoryId },
      );
  };

  const pickWallet = async (end: 'from' | 'to') => {
    const current = end === 'from' ? tx.walletId : tx.transferToWalletId;
    const picked = await openSheet({
      kind: 'wallet',
      title: end === 'from' ? 'Change wallet' : 'Change where it went',
      wallets: sameCurrencyWallets(
        transfer ? (end === 'from' ? tx.transferToWalletId : tx.walletId) : null,
      ),
      selectedId: current,
      emptyMessage: 'No other wallet uses this currency.',
    });
    if (!picked?.walletId || picked.walletId === current) return;
    if (end === 'from')
      saveWithUndo(
        tx.id,
        'Wallet',
        { walletId: picked.walletId },
        { walletId: tx.walletId },
      );
    else
      saveWithUndo(
        tx.id,
        'Wallet',
        { type: 'transfer', transferToWalletId: picked.walletId },
        { type: 'transfer', transferToWalletId: tx.transferToWalletId },
      );
  };

  const changeType = async () => {
    const next = tx.type === 'expense' ? 'income' : 'expense';
    const confirmed = await openSheet({
      kind: 'confirm',
      title: next === 'income' ? 'Make this income?' : 'Make this an expense?',
      message:
        next === 'income'
          ? 'It counts as money in, and you choose an income category for it.'
          : 'It counts as spending, and you choose an expense category for it.',
      confirmLabel: next === 'income' ? 'Make it income' : 'Make it an expense',
      cancelLabel: 'Keep it',
    });
    if (confirmed)
      saveWithUndo(
        tx.id,
        'Type',
        { type: next, categoryId: null },
        { type: tx.type, categoryId: tx.categoryId },
      );
  };

  const remove = async () => {
    const month = new Date(tx.transactionDate).toLocaleDateString(
      'en-US',
      { month: 'long' },
    );
    const confirmed = await openSheet({
      kind: 'confirm',
      title: 'Delete this transaction?',
      message: `${title} ${formatSignedMoney(tx.type, tx.amountMinor, tx.currency)} on ${formatDate(tx.transactionDate)} comes out of ${month}${category && !transfer ? ` and out of ${category.name}` : ''}.`,
      confirmLabel: 'Delete',
      cancelLabel: 'Keep it',
      destructive: true,
    });
    if (!confirmed) return;
    await deleteTransaction(tx.id);
    router.back();
  };

  const tiles: [Tile, Tile, Tile, Tile] = [
    transfer
      ? {
          name: 'from',
          label: 'From',
          value: wallet?.name ?? 'Wallet',
          dot: wallet?.color,
          action: { kind: 'pick', onPress: () => void pickWallet('from') },
        }
      : correction
      ? {
          name: 'category',
          label: 'Category',
          value: 'Not in budgets',
          icon: 'scale-balance',
          action: null,
        }
      : {
          name: 'category',
          label: 'Category',
          value: category?.name ?? 'Choose',
          icon: category
            ? resolveTransactionIcon(category.icon, tx.type)
            : undefined,
          action: { kind: 'pick', onPress: () => void pickCategory() },
        },
    transfer
      ? {
          name: 'to',
          label: 'To',
          value: toWallet?.name ?? 'Wallet',
          dot: toWallet?.color,
          action: { kind: 'pick', onPress: () => void pickWallet('to') },
        }
      : {
          name: 'wallet',
          label: 'Wallet',
          value: wallet?.name ?? 'Wallet',
          dot: wallet?.color,
          action: { kind: 'pick', onPress: () => void pickWallet('from') },
        },
    {
      name: 'type',
      label: 'Type',
      value: transfer ? 'Transfer' : tx.type === 'income' ? 'Income' : 'Expense',
      action:
        transfer || correction
          ? null
          : { kind: 'pick', onPress: () => void changeType() },
    },
    {
      name: 'source',
      label: 'Source',
      value: sourceLabel(source),
      icon: sourceIcon(source),
      action:
        source === 'notification'
          ? { kind: 'link', onPress: () => router.push('/capture-log') }
          : null,
    },
  ];

  const links: DetailLink[] = [
    ...(tx.locationName || tx.locationLatitude !== null
      ? [
          {
            name: 'place',
            title: label?.name ?? 'Where you paid',
            meta: [label?.area, 'open map'].filter(Boolean).join(' · '),
            icon: 'map-marker-outline',
            trailing: 'chevron-right',
            bubble: <MapThumb />,
            onPress: () =>
              place
                ? router.push({ pathname: '/place/[id]', params: { id: place.id } })
                : router.push('/map'),
          } satisfies DetailLink,
        ]
      : []),
    receipt,
    ...(sameMerchant.length >= 2
      ? [
          {
            name: 'same-merchant',
            title: `${title}, ${sameMerchant.length} times ${thisMonth ? 'this month' : `in ${new Date(tx.transactionDate).toLocaleDateString('en-US', { month: 'long' })}`}`,
            meta: `${formatMoney(
              sameMerchant.reduce(
                (sum, row) => sum + Number(row.amountMinor),
                0,
              ),
              tx.currency,
            )} in total · see ${sameMerchant.length === 2 ? 'both' : 'all'}`,
            icon: 'magnify',
            trailing: 'chevron-right',
            onPress: () =>
              router.dismissTo({
                pathname: '/activity',
                params: { q: title },
              }),
          } satisfies DetailLink,
        ]
      : []),
  ];

  const nameRow = (name: ReactNode) => (
    <View className="flex-row items-center gap-3">
      <TintBubble
        icon={
          correction
            ? 'scale-balance'
            : resolveTransactionIcon(category?.icon, tx.type)
        }
        color={
          correction
            ? tokens.lemon
            : transfer
              ? null
              : (category?.color ?? null)
        }
      />
      <View className="min-w-0 flex-1">
        {name}
        <Text
          variant="meta"
          className="text-muted"
          style={{ fontVariant: ['tabular-nums'] }}
        >
          {[
            formatDate(tx.transactionDate),
            clockTime(tx.transactionDate),
            alert ? `Alert says ${tx.merchant}` : null,
          ]
            .filter(Boolean)
            .join(' · ')}
        </Text>
      </View>
    </View>
  );

  return (
    <Page
      screen="txn"
      kind="pushed"
      title="Transaction"
    >
      <InPlaceGroup
        editing={editing}
        onEditingChange={setEditing}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerClassName="gap-3 px-screen pb-8"
        >
          <View className="gap-2.5">
            {correction ? (
              nameRow(
                <Text
                  variant="sectionTitle"
                  className="text-foreground"
                  numberOfLines={1}
                >
                  {title}
                </Text>,
              )
            ) : (
              <InPlaceField
                testID={tid('txn', 'merchant')}
                label="Name"
                kind="text"
                required
                value={title}
                maxLength={40}
                hint={
                  alert
                    ? `The alert says ${tx.merchant}. Moni uses your name for every ${tx.merchant} payment.`
                    : undefined
                }
                onSave={saveName}
              >
                {({ editable, editor }) =>
                  editor ??
                  nameRow(
                    editable(
                      <Text
                        variant="sectionTitle"
                        className="text-foreground"
                        numberOfLines={1}
                      >
                        {title}
                      </Text>,
                    ),
                  )
                }
              </InPlaceField>
            )}

            <InPlaceField
              testID={tid('txn', 'amount')}
              label="Amount"
              kind="amount"
              prefix={`${sign}${currencySymbol(tx.currency)}`}
              value={tx.amountMinor}
              hint={tx.currency}
              onSave={(value) =>
                value === tx.amountMinor
                  ? undefined
                  : update(tx.id, { amountMinor: value }, { amountMinor: tx.amountMinor })
              }
            >
              {({ editable, editor }) =>
                editor ?? (
                  <View>
                    {editable(
                      <Text
                        variant="amountHero"
                        className={
                          tx.type === 'income'
                            ? 'text-deep-mint'
                            : transfer
                              ? 'text-muted'
                              : 'text-foreground'
                        }
                        style={{ fontVariant: ['tabular-nums'] }}
                        adjustsFontSizeToFit
                        numberOfLines={1}
                      >
                        {formatSignedMoney(tx.type, tx.amountMinor, tx.currency)}
                      </Text>,
                    )}
                  </View>
                )
              }
            </InPlaceField>
          </View>

          <DetailTiles tiles={tiles} />

          {budget ? <BudgetLine budget={budget} /> : null}

          <View className="gap-1.5 rounded-card bg-card pb-3.5 pl-[18px] pr-3 pt-3">
            <InPlaceField
              testID={tid('txn', 'note')}
              label="Note"
              kind="note"
              value={tx.notes ?? ''}
              maxLength={1000}
              placeholder="Who it was with, what it was for"
              onSave={(value) =>
                value === (tx.notes ?? '')
                  ? undefined
                  : update(tx.id, { notes: value || null }, { notes: tx.notes })
              }
            >
              {({ editable, editor, open }) => (
                <>
                  <View className="min-h-8 flex-row items-center justify-between gap-2">
                    <Text
                      variant="meta"
                      className="text-muted"
                    >
                      Note
                    </Text>
                    {tx.notes && editing === null ? (
                      <Press
                        testID={tid('txn', 'note', 'pencil')}
                        accessibilityLabel="Edit note"
                        accessibilityHint="Opens the keyboard"
                        hitSlop={6}
                        pressedClassName="bg-hairline"
                        className="h-8 w-8 items-center justify-center rounded-full bg-sand"
                        onPress={open}
                      >
                        <IconSymbol
                          name="pencil-outline"
                          size={16}
                          color={tokens.foreground}
                        />
                      </Press>
                    ) : null}
                  </View>
                  {editor ??
                    editable(
                      <Text
                        variant="body"
                        className={`pr-1 ${tx.notes ? 'text-foreground' : 'text-muted'}`}
                      >
                        {tx.notes || 'Add a note: who it was with, what it was for'}
                      </Text>,
                      {
                        pencil: false,
                        className: 'min-h-11 flex-row items-center',
                      },
                    )}
                </>
              )}
            </InPlaceField>
          </View>

          <DetailLinks links={links} />

          <Button
            testID={tid('txn', 'delete')}
            variant="destructive"
            icon="trash-can-outline"
            label="Delete transaction"
            className="mt-1"
            onPress={() => void remove()}
          />
        </ScrollView>
      </InPlaceGroup>
    </Page>
  );
}
