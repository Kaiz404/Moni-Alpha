import { syncState } from '@legendapp/state';
import { useSelector, useValue } from '@legendapp/state/react';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, View } from 'react-native';

import { DayGroup } from '@/components/activity/day-group';
import { FilterChips } from '@/components/activity/filter-chips';
import { ReviewStrip } from '@/components/activity/review-strip';
import { SearchField } from '@/components/activity/search-field';
import {
  ActivityChart,
  type ActivityChartMode,
} from '@/components/charts/activity-chart';
import { useTabBarClearance } from '@/components/nav/tab-bar';
import { SyncBanner } from '@/components/providers/sync-banner';
import { EmptyTile } from '@/components/ui/empty-tile';
import { MoniButton } from '@/components/ui/header-icon-button';
import {
  HoldHint,
  HoldMenu,
  type HoldAction,
  type HoldAnchor,
} from '@/components/ui/hold-menu';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Page } from '@/components/ui/page';
import { Press } from '@/components/ui/press';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import {
  TransactionRow,
  TransactionRowBody,
  rowAmount,
  rowMeta,
} from '@/components/ui/transaction-row';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { useAuth } from '@/lib/auth/auth-context';
import { dayLabel, formatDate, formatDayHeading } from '@/lib/dates/day-label';
import {
  filterActivity,
  groupActivityDays,
  type ActivityDay,
  type ActivityKind,
} from '@/lib/finance/activity-filter';
import { balanceMonth, spendingMonth } from '@/lib/finance/activity-series';
import { formatMoney } from '@/lib/finance/format-money';
import { useMainCurrency } from '@/lib/finance/main-currency';
import { merchantName } from '@/lib/finance/merchant-name';
import {
  budgetProgress$,
  categoriesForUser$,
  pendingProposals$,
  transactions$,
  walletsForUser$,
} from '@/lib/finance/selectors';
import type { FinanceTransaction } from '@/lib/finance/types';
import { toCategoryTiles } from '@/lib/sheet/category-tiles';
import { openSheet } from '@/lib/sheet/sheet-store';
import { transactions$ as transactionTable$ } from '@/lib/store';
import { listMerchantAliases } from '@/lib/supabase/merchant-aliases';
import { ensureFinanceTimezone } from '@/lib/supabase/profile';
import {
  deleteTransaction,
  updateTransaction,
} from '@/lib/supabase/transactions';
import { tid } from '@/lib/test-ids';
import {
  transactionRow,
  type RowLookups,
  type TransactionRowData,
} from '@/lib/transactions/row';

const FIRST_DAYS = 5;
const MORE_DAYS = 10;

type Held = {
  transaction: FinanceTransaction;
  row: TransactionRowData;
  anchor: HoldAnchor;
};

function holdable(transaction: FinanceTransaction) {
  return (
    transaction.type !== 'transfer' && !transaction.debtActivityId
  );
}

function dayTotal(day: ActivityDay, currency: string) {
  return [
    day.spentMinor > 0
      ? `−${formatMoney(day.spentMinor, currency)}`
      : null,
    day.inMinor > 0 ? `+${formatMoney(day.inMinor, currency)}` : null,
  ]
    .filter(Boolean)
    .join(' · ');
}

export default function ActivityScreen() {
  const { user } = useAuth();
  const tokens = useThemeTokens();
  const clearance = useTabBarClearance();
  const userId = user?.id ?? null;
  const currency = useMainCurrency();
  const all = useValue(transactions$({ userId }));
  const wallets = useValue(walletsForUser$(userId));
  const categories = useValue(categoriesForUser$(userId));
  const proposals = useValue(pendingProposals$(userId));
  const aliases = useValue(() =>
    userId ? listMerchantAliases(userId) : [],
  );
  const loaded = useSelector(
    () => syncState(transactionTable$).get().isPersistLoaded,
  );
  const [timezone, setTimezone] = useState('UTC');
  const progress = useValue(budgetProgress$(userId, timezone));
  const [mode, setMode] = useState<ActivityChartMode>('spending');
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState<ActivityKind>('all');
  const [walletId, setWalletId] = useState<string | null>(null);
  const [day, setDay] = useState<string | null>(null);
  const [shownDays, setShownDays] = useState(FIRST_DAYS);
  const [held, setHeld] = useState<Held | null>(null);
  const now = new Date();

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
  const named = useMemo(
    () =>
      all.map((transaction) =>
        transaction.merchant
          ? {
              ...transaction,
              merchant: merchantName(transaction.merchant, aliases),
            }
          : transaction,
      ),
    [all, aliases],
  );
  const inCurrency = useMemo(
    () => named.filter((transaction) => transaction.currency === currency),
    [named, currency],
  );
  const days = useMemo(
    () =>
      groupActivityDays(
        filterActivity(named, {
          query,
          walletId,
          mainCurrency: currency,
          kind,
          day,
          categoryNames: Object.fromEntries(
            categories.map((category) => [category.id, category.name]),
          ),
        }),
      ),
    [named, query, walletId, currency, kind, day, categories],
  );
  const budgetMinor = useMemo(() => {
    const budgets = progress.filter(
      (row) => row.currency === currency && row.budgetAmountMinor !== null,
    );
    return budgets.length
      ? budgets.reduce((sum, row) => sum + Number(row.budgetAmountMinor), 0)
      : null;
  }, [progress, currency]);
  const today = now.toDateString();
  const spending = useMemo(
    () => spendingMonth(inCurrency, budgetMinor, currency, new Date()),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- recompute when the day turns over
    [inCurrency, budgetMinor, currency, today],
  );
  const balance = useMemo(
    () => balanceMonth(wallets, all, currency, new Date()),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- recompute when the day turns over
    [wallets, all, currency, today],
  );
  const reviewTotal = proposals
    .filter((proposal) => proposal.currency === currency)
    .reduce((sum, proposal) => sum + Number(proposal.amountMinor ?? 0), 0);
  const mainWallets = wallets.filter(
    (wallet) => wallet.currency === currency,
  );
  const walletName =
    mainWallets.find((wallet) => wallet.id === walletId)?.name ?? null;
  const visible = day ? days : days.slice(0, shownDays);
  const earlier = Math.min(MORE_DAYS, days.length - visible.length);

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

  const pickWallet = async () => {
    const picked = await openSheet({
      kind: 'wallet',
      title: 'Show wallet',
      wallets: mainWallets.map((wallet) => ({
        id: wallet.id,
        name: wallet.name,
        currency: wallet.currency,
        type: wallet.type,
        icon: wallet.icon,
        color: wallet.color,
        cardStyleId: wallet.cardStyleId,
      })),
      selectedId: walletId,
      noneLabel: 'All wallets',
    });
    if (picked) setWalletId(picked.walletId);
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
    transaction.debtActivityId
      ? router.navigate('/debts')
      : router.push({
          pathname: '/transaction/[id]',
          params: { id: transaction.id },
        });

  const dayRows = days.reduce(
    (sum, group) => sum + group.transactions.length,
    0,
  );

  return (
    <Page
      screen="activity"
      kind="tabRoot"
      title="Activity"
      trailing={
        <>
          {proposals.length ? (
            <ReviewStrip
              count={proposals.length}
              amount={
                reviewTotal > 0 ? formatMoney(reviewTotal, currency) : null
              }
              onPress={() =>
                router.push({
                  pathname: '/proposal/[id]',
                  params: { id: proposals[0].id },
                })
              }
            />
          ) : null}
          <MoniButton
            testID={tid('activity', 'ask-moni')}
            onPress={() => router.push('/chat')}
          />
        </>
      }
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerClassName="gap-4 px-screen"
        contentContainerStyle={{ paddingBottom: clearance }}
      >
        <SyncBanner screen="activity" />
        {!loaded ? (
          <Skeleton rows={4} />
        ) : inCurrency.length === 0 ? (
          <EmptyTile
            icon="format-list-bulleted"
            title="No spending yet"
            body="Add your first spend with + or link a bank app so Moni catches them for you."
            action={{
              testID: tid('activity', 'empty', 'link'),
              label: 'Link a bank app',
              icon: 'bank-outline',
              onPress: () => router.push('/notifications'),
            }}
          />
        ) : (
          <>
            <ActivityChart
              mode={mode}
              onModeChange={setMode}
              spending={spending}
              balance={balance}
              currency={currency}
              selectedDay={day}
              onSelectDay={setDay}
              now={now}
            />
            {day ? (
              <View className="flex-row items-center justify-between gap-3 px-1">
                <Text variant="rowTitle" className="text-foreground">
                  {`${dayLabel(day, now)} · ${dayRows} ${dayRows === 1 ? 'transaction' : 'transactions'}`}
                </Text>
                <Press
                  testID={tid('activity', 'whole-month')}
                  onPress={() => setDay(null)}
                  radius={{ rest: 18, pressed: 16 }}
                  pressedClassName="bg-hairline"
                  className="h-9 flex-row items-center gap-1 bg-sand px-3.5"
                >
                  <Text className="text-[14px] leading-[19px] font-display-semibold text-foreground">
                    Whole month
                  </Text>
                  <IconSymbol
                    name="close"
                    size={16}
                    color={tokens.foreground}
                  />
                </Press>
              </View>
            ) : null}
            <SearchField
              value={query}
              onChange={setQuery}
            />
            <FilterChips
              kind={kind}
              onKind={setKind}
              walletName={walletName}
              onWallet={() => void pickWallet()}
            />
            <HoldHint screen="activity" />
            {visible.length === 0 ? (
              <EmptyTile
                icon="magnify-close"
                title={
                  query.trim()
                    ? `No matches for "${query.trim()}"`
                    : day
                      ? 'Nothing like that on this day'
                      : 'Nothing matches'
                }
                body={
                  query.trim()
                    ? 'Try a merchant, a category or an amount like 18.90.'
                    : 'Try another filter or day.'
                }
              />
            ) : (
              <View className="gap-section">
                {visible.map((group) => (
                  <DayGroup
                    key={group.key}
                    label={formatDayHeading(
                      group.transactions[0].transactionDate,
                      now,
                    )}
                    total={dayTotal(group, currency)}
                  >
                    {group.transactions.map((transaction) => {
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
                          now={now}
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
                  </DayGroup>
                ))}
              </View>
            )}
            {earlier > 0 ? (
              <Press
                testID={tid('activity', 'show-more')}
                onPress={() => setShownDays(visible.length + MORE_DAYS)}
                radius={{ rest: 22, pressed: 16 }}
                pressedClassName="bg-hairline"
                className="h-11 flex-row items-center gap-1.5 self-center bg-sand px-[18px]"
              >
                <Text className="text-[15px] leading-[21px] font-display-semibold text-foreground">
                  {`Show ${earlier} earlier ${earlier === 1 ? 'day' : 'days'}`}
                </Text>
                <IconSymbol
                  name="chevron-down"
                  size={18}
                  color={tokens.foreground}
                />
              </Press>
            ) : null}
          </>
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
