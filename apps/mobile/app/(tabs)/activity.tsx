import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  RefreshControl,
  ScrollView,
  View,
} from 'react-native';
import { useTabBarClearance } from '@/components/nav/tab-bar';
import { Text } from '@/components/ui/text';
import { router, useLocalSearchParams } from 'expo-router';
import { syncState } from '@legendapp/state';
import { useSelector, useValue } from '@legendapp/state/react';
import { Page } from '@/components/ui/page';
import { SyncBanner } from '@/components/providers/sync-banner';
import { EmptyTile } from '@/components/ui/empty-tile';
import {
  HeaderIconButton,
  MoniButton,
} from '@/components/ui/header-icon-button';
import {
  HoldHint,
  HoldMenu,
  type HoldAction,
  type HoldAnchor,
} from '@/components/ui/hold-menu';
import { ListSection } from '@/components/ui/list-card';
import { Skeleton } from '@/components/ui/skeleton';
import { SolidWalletCard } from '@/components/ui/solid-wallet-card';
import {
  TransactionRow,
  TransactionRowBody,
  rowAmount,
  rowMeta,
} from '@/components/ui/transaction-row';
import { getWalletCardStyle } from '@/constants/wallet-card-styles';
import { useAuth } from '@/lib/auth/auth-context';
import { formatDate, formatDayHeading } from '@/lib/dates/day-label';
import { toLocalDateInput } from '@/lib/dates/local-date-input';
import {
  formatMoney,
  formatSignedMoney,
} from '@/lib/finance/format-money';
import {
  budgetProgress$,
  categoriesForUser$,
  pendingProposals$,
  transactions$,
  walletBalanceMinor$,
  walletById$,
  walletsForUser$,
} from '@/lib/finance/selectors';
import type { FinanceTransaction } from '@/lib/finance/types';
import { toCategoryTiles } from '@/lib/sheet/category-tiles';
import { openSheet } from '@/lib/sheet/sheet-store';
import { transactions$ as transactionTable$ } from '@/lib/store';
import { ensureFinanceTimezone } from '@/lib/supabase/profile';
import {
  deleteTransaction,
  updateTransaction,
} from '@/lib/supabase/transactions';
import { tid } from '@/lib/test-ids';
import {
  proposalRow,
  transactionRow,
  type RowLookups,
  type TransactionRowData,
} from '@/lib/transactions/row';

type Held = {
  transaction: FinanceTransaction;
  row: TransactionRowData;
  anchor: HoldAnchor;
};

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function holdable(transaction: FinanceTransaction) {
  return (
    transaction.type !== 'transfer' && !transaction.debtActivityId
  );
}

export default function TransactionsScreen() {
  const { user } = useAuth();
  const clearance = useTabBarClearance();
  const userId = user?.id ?? null;
  const params = useLocalSearchParams<{
    walletId?: string | string[];
    categoryId?: string | string[];
    currency?: string | string[];
    month?: string | string[];
  }>();
  const walletId = firstParam(params.walletId);
  const rows = useValue(
    transactions$({
      userId,
      walletId,
      categoryId: firstParam(params.categoryId),
      currency: firstParam(params.currency),
      month: firstParam(params.month),
    }),
  );
  const wallets = useValue(walletsForUser$(userId));
  const categories = useValue(categoriesForUser$(userId));
  const proposals = useValue(pendingProposals$(userId));
  const loaded = useSelector(
    () => syncState(transactionTable$).get().isPersistLoaded,
  );
  const selectedWallet = useValue(walletById$(walletId ?? ''));
  const selectedBalance = useValue(
    walletBalanceMinor$(walletId ?? ''),
  );
  const selectedWalletStyle = getWalletCardStyle(
    selectedWallet?.cardStyleId,
  );
  const [refreshing, setRefreshing] = useState(false);
  const [held, setHeld] = useState<Held | null>(null);
  const [timezone, setTimezone] = useState('UTC');
  const progress = useValue(budgetProgress$(userId, timezone));

  useEffect(() => {
    void ensureFinanceTimezone()
      .then(setTimezone)
      .catch(() => {});
  }, []);

  const lookups = useMemo<RowLookups>(
    () => ({
      categoriesById: Object.fromEntries(
        categories.map((category) => [category.id, category]),
      ),
      walletNames: Object.fromEntries(
        wallets.map((wallet) => [wallet.id, wallet.name]),
      ),
    }),
    [categories, wallets],
  );
  const days = useMemo(() => {
    const groups: {
      key: string;
      label: string;
      items: FinanceTransaction[];
    }[] = [];
    for (const transaction of rows) {
      const key = toLocalDateInput(
        new Date(transaction.transactionDate),
      );
      const last = groups.at(-1);
      if (last?.key === key) last.items.push(transaction);
      else
        groups.push({
          key,
          label: formatDayHeading(transaction.transactionDate),
          items: [transaction],
        });
    }
    return groups;
  }, [rows]);
  const stats = useMemo(
    () =>
      rows.reduce(
        (all, row) => ({
          income:
            all.income +
            (row.type === 'income' ? Number(row.amountMinor) : 0),
          expense:
            all.expense +
            (row.type === 'expense' ? Number(row.amountMinor) : 0),
        }),
        { income: 0, expense: 0 },
      ),
    [rows],
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => resolve()),
    );
    setRefreshing(false);
  };

  const save = (
    id: string,
    change: { categoryId: string } | { walletId: string },
  ) => {
    updateTransaction(id, change).catch((error: unknown) =>
      Alert.alert(
        'Not saved',
        error instanceof Error ? error.message : 'Try again.',
      ),
    );
  };

  const editCategory = async (transaction: FinanceTransaction) => {
    const picked = await openSheet({
      kind: 'category',
      title: 'Edit category',
      currency: transaction.currency,
      categories: toCategoryTiles(
        categories.filter(
          (category) =>
            category.isActive && category.type === transaction.type,
        ),
        progress,
        transaction.currency,
      ),
      selectedId: transaction.categoryId,
    });
    if (picked && picked !== transaction.categoryId)
      save(transaction.id, { categoryId: picked });
  };

  const changeWallet = async (transaction: FinanceTransaction) => {
    const picked = await openSheet({
      kind: 'wallet',
      title: 'Change wallet',
      wallets: wallets
        .filter((wallet) => wallet.currency === transaction.currency)
        .map((wallet) => ({
          id: wallet.id,
          name: wallet.name,
          currency: wallet.currency,
          type: wallet.type,
          icon: wallet.icon,
          color: wallet.color,
          cardStyleId: wallet.cardStyleId,
        })),
      selectedId: transaction.walletId,
      emptyMessage: 'No other wallet uses this currency.',
    });
    if (picked?.walletId && picked.walletId !== transaction.walletId)
      save(transaction.id, { walletId: picked.walletId });
  };

  const remove = async (
    transaction: FinanceTransaction,
    row: TransactionRowData,
  ) => {
    const month = new Date(row.date).toLocaleDateString('en-US', {
      month: 'long',
    });
    const category = 'category' in row ? row.category : null;
    const confirmed = await openSheet({
      kind: 'confirm',
      title: 'Delete this transaction?',
      message: `${row.title} ${formatMoney(row.amountMinor, row.currency)} on ${formatDate(row.date)} comes out of ${month}${category ? ` and out of ${category}` : ''}.`,
      confirmLabel: 'Delete',
      cancelLabel: 'Keep it',
      destructive: true,
    });
    if (confirmed) void deleteTransaction(transaction.id);
  };

  const act = (action: HoldAction) => {
    if (!held) return;
    const { transaction, row } = held;
    setHeld(null);
    if (action === 'delete') void remove(transaction, row);
    else if (action === 'editCategory')
      void editCategory(transaction);
    else void changeWallet(transaction);
  };

  const open = (transaction: FinanceTransaction) =>
    router.push(
      transaction.debtActivityId
        ? ('/debts' as never)
        : ({
            pathname: '/transaction/[id]',
            params: { id: transaction.id },
          } as never),
    );

  return (
    <Page
      screen="activity"
      kind="tabRoot"
      title="Activity"
      trailing={
        <>
          <HeaderIconButton
            testID={tid('activity', 'add')}
            icon="plus"
            accessibilityLabel="Add a transaction"
            onPress={() =>
              router.push(
                (walletId
                  ? `/transaction/new?walletId=${walletId}`
                  : '/transaction/new') as never,
              )
            }
          />
          <MoniButton
            testID={tid('activity', 'ask-moni')}
            onPress={() => router.push('/chat')}
          />
        </>
      }
    >
      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
          />
        }
        contentContainerClassName="gap-section px-screen"
        contentContainerStyle={{ paddingBottom: clearance }}
      >
        <SyncBanner screen="activity" />
        {selectedWallet ? (
          <SolidWalletCard
            cardStyle={selectedWalletStyle}
            className="rounded-3xl p-4"
          >
            <Text
              className="text-sm"
              style={{ color: selectedWalletStyle.contentMutedColor }}
            >
              {selectedWallet.name}
            </Text>
            <Text
              className="mt-1 text-2xl font-display-bold"
              style={{ color: selectedWalletStyle.contentColor }}
            >
              {formatMoney(selectedBalance, selectedWallet.currency)}
            </Text>
            <View className="mt-3 flex-row gap-4">
              <Text
                style={{ color: selectedWalletStyle.contentColor }}
              >
                {formatSignedMoney(
                  'income',
                  stats.income,
                  selectedWallet.currency,
                )}
              </Text>
              <Text
                style={{ color: selectedWalletStyle.contentColor }}
              >
                {formatSignedMoney(
                  'expense',
                  stats.expense,
                  selectedWallet.currency,
                )}
              </Text>
            </View>
          </SolidWalletCard>
        ) : null}

        {proposals.length ? (
          <ListSection label="To review">
            {proposals.map((proposal) => (
              <TransactionRow
                key={proposal.id}
                testID={tid('activity', 'proposal', proposal.id)}
                row={proposalRow(proposal, lookups)}
                metaLead="date"
                onPress={() =>
                  router.push({
                    pathname: '/proposal/[id]',
                    params: { id: proposal.id },
                  } as never)
                }
              />
            ))}
          </ListSection>
        ) : null}

        {!loaded ? (
          <Skeleton rows={4} />
        ) : days.length === 0 ? (
          <EmptyTile
            icon="format-list-bulleted"
            title="No spending yet"
            body="Add your first spend with + or link a bank app so Moni catches them for you."
            action={{
              testID: tid('activity', 'empty', 'add'),
              label: 'Add a spend',
              icon: 'plus',
              onPress: () => router.push('/transaction/new' as never),
            }}
          />
        ) : (
          <View className="gap-section">
            <HoldHint screen="activity" />
            {days.map((day) => (
              <ListSection
                key={day.key}
                label={day.label}
              >
                {day.items.map((transaction) => {
                  const row = transactionRow(transaction, lookups);
                  return (
                    <TransactionRow
                      key={transaction.id}
                      testID={tid(
                        'activity',
                        'transaction',
                        transaction.id,
                      )}
                      row={row}
                      metaLead="category"
                      onPress={() => open(transaction)}
                      onHold={
                        holdable(transaction)
                          ? (anchor) =>
                              setHeld({ transaction, row, anchor })
                          : undefined
                      }
                    />
                  );
                })}
              </ListSection>
            ))}
          </View>
        )}
      </ScrollView>

      <HoldMenu
        screen="activity"
        anchor={held?.anchor ?? null}
        rowTitle={held?.row.title ?? ''}
        liftedRow={
          held ? (
            <TransactionRowBody
              row={held.row}
              meta={rowMeta(held.row, 'category')}
              amount={rowAmount(held.row)}
            />
          ) : null
        }
        onAction={act}
        onClose={() => setHeld(null)}
      />
    </Page>
  );
}
