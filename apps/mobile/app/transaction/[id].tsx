import { useValue } from '@legendapp/state/react';
import {
  decimalToMinor,
  minorToNumber,
  type MinorAmount,
  type UpdateTransaction,
} from '@repo/types';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, View } from 'react-native';

import { BudgetLine } from '@/components/transaction/budget-line';
import {
  DetailLinks,
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
import {
  InPlaceField,
  InPlaceGroup,
} from '@/components/transaction/in-place-field';
import { Button } from '@/components/ui/button';
import { NotFound } from '@/components/ui/empty-tile';
import { Page } from '@/components/ui/page';
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
import { tid } from '@/lib/test-ids';
import { showToast } from '@/lib/toast/toast-store';
import { resolveTransactionIcon } from '@/lib/transactions/icon';

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

/** Writes a change, then offers Undo that writes the previous values back. */
function saveWithUndo(
  id: string,
  label: string,
  change: UpdateTransaction,
  previous: UpdateTransaction,
) {
  updateTransaction(id, change)
    .then(() =>
      showToast({
        text: `${label} saved`,
        undo: () => void updateTransaction(id, previous).catch(notSaved),
      }),
    )
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
  const title = transfer
    ? (tx.description ?? 'Transfer')
    : (merchantName(tx.merchant, aliases) ??
      tx.description ??
      category?.name ??
      'Transaction');
  const amount = minorToNumber(tx.amountMinor);
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
  const sameMerchant = useMemo(() => {
    if (!tx.merchant || transfer) return [];
    const month = tx.transactionDate.slice(0, 7);
    const key = tx.merchant.toLowerCase();
    return all.filter(
      (row) =>
        row.merchant?.toLowerCase() === key &&
        row.currency === tx.currency &&
        row.type === tx.type &&
        row.transactionDate.slice(0, 7) === month,
    );
  }, [all, tx, transfer]);
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

  const saveName = (next: string) => {
    const key = alert ? merchantKey(tx.merchant) : null;
    if (key) {
      const previous = title;
      nameMerchant(key, next)
        .then(() =>
          showToast({
            text: 'Name saved',
            undo: () => void nameMerchant(key, previous).catch(notSaved),
          }),
        )
        .catch(notSaved);
    } else if (transfer)
      saveWithUndo(
        tx.id,
        'Name',
        { description: next },
        { description: tx.description },
      );
    else
      saveWithUndo(
        tx.id,
        'Name',
        { merchant: next },
        { merchant: tx.merchant },
      );
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
      message: `${title} ${formatMoney(tx.amountMinor, tx.currency)} on ${formatDate(tx.transactionDate)} comes out of ${month}${category && !transfer ? ` and out of ${category.name}` : ''}.`,
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
      action: transfer
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
          ? { kind: 'link', onPress: () => router.push('/notifications') }
          : null,
    },
  ];

  const links: DetailLink[] = [
    ...(tx.locationName || tx.locationLatitude !== null
      ? [
          {
            name: 'place',
            title: tx.locationName ?? 'Where you paid',
            meta: 'Open the map',
            icon: 'map-marker-outline',
            trailing: 'chevron-right',
            onPress: () => router.push('/heatmap'),
          } satisfies DetailLink,
        ]
      : []),
    receipt,
    ...(sameMerchant.length >= 2
      ? [
          {
            name: 'same-merchant',
            title: `${title}, ${sameMerchant.length} times this month`,
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
                params: { q: tx.merchant ?? title },
              }),
          } satisfies DetailLink,
        ]
      : []),
  ];

  return (
    <Page
      screen="txn"
      kind="pushed"
      title="Transaction"
    >
      <InPlaceGroup>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerClassName="gap-4 px-screen pb-8"
        >
          <View className="flex-row items-start gap-3">
            <TintBubble
              icon={resolveTransactionIcon(category?.icon, tx.type)}
              color={transfer ? null : (category?.color ?? null)}
            />
            <View className="min-w-0 flex-1 gap-0.5">
              <InPlaceField
                screen="txn"
                name="merchant"
                label={alert ? 'merchant name' : 'name'}
                kind="name"
                value={title}
                maxLength={40}
                hint={
                  alert
                    ? `The alert says ${tx.merchant}. Moni uses your name for every ${tx.merchant} payment.`
                    : undefined
                }
                onSave={saveName}
              >
                <Text
                  variant="sectionTitle"
                  className="text-foreground"
                  numberOfLines={2}
                >
                  {title}
                </Text>
              </InPlaceField>
              <Text
                variant="meta"
                className="text-muted"
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

          <InPlaceField
            screen="txn"
            name="amount"
            label="amount"
            kind="amount"
            prefix={`${sign}${currencySymbol(tx.currency)}`}
            value={amount}
            hint={tx.currency}
            onSave={(value) =>
              saveWithUndo(
                tx.id,
                'Amount',
                { amountMinor: decimalToMinor(value.toFixed(2)) as MinorAmount },
                { amountMinor: tx.amountMinor },
              )
            }
          >
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
            </Text>
          </InPlaceField>

          <DetailTiles tiles={tiles} />

          {budget ? <BudgetLine budget={budget} /> : null}

          <View className="gap-1.5 rounded-card bg-card px-[18px] py-3.5">
            <Text
              variant="meta"
              className="text-muted"
            >
              Note
            </Text>
            <InPlaceField
              screen="txn"
              name="note"
              label="note"
              kind="note"
              value={tx.notes ?? ''}
              pencil={Boolean(tx.notes)}
              maxLength={1000}
              placeholder="Who it was with, what it was for"
              onSave={(value) =>
                saveWithUndo(
                  tx.id,
                  'Note',
                  { notes: value || null },
                  { notes: tx.notes },
                )
              }
            >
              <Text
                variant="body"
                className={tx.notes ? 'text-foreground' : 'text-muted'}
              >
                {tx.notes || 'Add a note: who it was with, what it was for'}
              </Text>
            </InPlaceField>
          </View>

          <DetailLinks links={links} />

          <Button
            testID={tid('txn', 'delete')}
            variant="destructive"
            icon="trash-can-outline"
            label="Delete transaction"
            pinned
            onPress={() => void remove()}
          />
        </ScrollView>
      </InPlaceGroup>
    </Page>
  );
}
