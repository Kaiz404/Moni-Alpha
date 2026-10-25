import { syncState } from '@legendapp/state';
import { useSelector, useValue } from '@legendapp/state/react';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';

import { DayGroup } from '@/components/activity/day-group';
import { useBudgetData, useBudgetMonth } from '@/components/budget/use-budget';
import { FilterChips } from '@/components/activity/filter-chips';
import { ReviewStrip } from '@/components/activity/review-strip';
import {
  ActivityChart,
  type ActivityChartMode,
} from '@/components/charts/activity-chart';
import { useTabBarClearance } from '@/components/nav/tab-bar';
import { SyncBanner } from '@/components/providers/sync-banner';
import { EmptyTile } from '@/components/ui/empty-tile';
import { MoniButton } from '@/components/ui/header-icon-button';
import { useTransactionHold } from '@/components/transaction/use-transaction-hold';
import { HoldHint } from '@/components/ui/hold-menu';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Page } from '@/components/ui/page';
import { SearchField } from '@/components/ui/search-field';
import { Press } from '@/components/ui/press';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { TransactionRow } from '@/components/ui/transaction-row';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { useAuth } from '@/lib/auth/auth-context';
import { dayLabel, formatDayHeading } from '@/lib/dates/day-label';
import { toLocalDateInput } from '@/lib/dates/local-date-input';
import {
  filterActivity,
  groupActivityDays,
  type ActivityDay,
  type ActivityKind,
} from '@/lib/finance/activity-filter';
import { balanceMonth, spendingMonth } from '@/lib/finance/activity-series';
import { monthKey } from '@/lib/finance/budget-month';
import { formatMoney } from '@/lib/finance/format-money';
import { useMainCurrency } from '@/lib/finance/main-currency';
import { merchantName } from '@/lib/finance/merchant-name';
import { groupPlaces, placeRange } from '@/lib/finance/places';
import {
  categoriesForUser$,
  pendingProposals$,
  transactions$,
  walletsForUser$,
} from '@/lib/finance/selectors';
import type { FinanceTransaction } from '@/lib/finance/types';
import { openSheet } from '@/lib/sheet/sheet-store';
import { transactions$ as transactionTable$ } from '@/lib/store';
import { listMerchantAliases } from '@/lib/supabase/merchant-aliases';
import { isAwaitingReview } from '@/lib/supabase/proposed-transactions';
import { tid } from '@/lib/test-ids';
import { transactionRow, type RowLookups } from '@/lib/transactions/row';

const FIRST_DAYS = 5;
const MORE_DAYS = 10;

function dayOf(key: string): Date {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month - 1, day);
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
  const hold = useTransactionHold('activity');
  const budgetData = useBudgetData();
  const budgetMonth = useBudgetMonth(budgetData, monthKey(budgetData.now));
  const [mode, setMode] = useState<ActivityChartMode>('spending');
  const params = useLocalSearchParams<{
    q?: string;
    placeId?: string;
    range?: string;
  }>();
  const [place, setPlace] = useState<{ id: string; range: string | null } | null>(null);
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState<ActivityKind>('all');
  const [walletId, setWalletId] = useState<string | null>(null);
  const [day, setDay] = useState<string | null>(null);
  const [shownDays, setShownDays] = useState(FIRST_DAYS);
  const now = new Date();

  // A link from another page replaces whatever filters were left, then clears its params so the same link works again.
  useEffect(() => {
    const { q, placeId, range } = params;
    if (!q && !placeId) return;
    setQuery(q ?? '');
    setPlace(placeId ? { id: placeId, range: range ?? null } : null);
    setKind('all');
    setWalletId(null);
    setDay(null);
    router.setParams({ q: undefined, placeId: undefined, range: undefined });
  }, [params]);

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
  const shownPlace = useMemo(
    () =>
      place
        ? (groupPlaces(named, {
            currency,
            range: place.range ? placeRange(place.range, new Date()) : null,
          }).find((candidate) => candidate.id === place.id) ?? null)
        : null,
    [named, place, currency],
  );
  const days = useMemo(
    () =>
      groupActivityDays(
        filterActivity(shownPlace ? shownPlace.transactions : named, {
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
    [named, shownPlace, query, walletId, currency, kind, day, categories],
  );
  const waiting = proposals.filter((proposal) => isAwaitingReview(proposal, new Date()));
  const todayKey = toLocalDateInput(now);
  const spending = useMemo(
    () => spendingMonth(inCurrency, budgetMonth, currency, dayOf(todayKey)),
    [inCurrency, budgetMonth, currency, todayKey],
  );
  const balance = useMemo(
    () => balanceMonth(wallets, all, currency, dayOf(todayKey)),
    [wallets, all, currency, todayKey],
  );
  const reviewTotal = waiting
    .filter((proposal) => proposal.currency === currency)
    .reduce((sum, proposal) => sum + Number(proposal.amountMinor ?? 0), 0);
  const mainWallets = wallets.filter(
    (wallet) => wallet.currency === currency,
  );
  const walletName =
    mainWallets.find((wallet) => wallet.id === walletId)?.name ?? null;
  const visible = day ? days : days.slice(0, shownDays);
  const earlier = Math.min(MORE_DAYS, days.length - visible.length);

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
          {waiting.length ? (
            <ReviewStrip
              count={waiting.length}
              amount={
                reviewTotal > 0 ? formatMoney(reviewTotal, currency) : null
              }
              onPress={() =>
                router.push({
                  pathname: '/review',
                  params: { id: waiting[0].id },
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
              onPress: () => router.push('/capture-sources'),
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
              testID={tid('activity', 'search')}
              accessibilityLabel="Search transactions"
              placeholder="Search merchant, note or amount"
              value={query}
              onChangeText={setQuery}
            />
            <FilterChips
              kind={kind}
              onKind={setKind}
              walletName={walletName}
              placeName={shownPlace?.name ?? null}
              onClearPlace={() => setPlace(null)}
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
                          onHold={hold.holdFor(transaction, row)}
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

      {hold.menu}
    </Page>
  );
}
