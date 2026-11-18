import { syncState } from '@legendapp/state';
import { useSelector, useValue } from '@legendapp/state/react';
import { router, useScrollToTop } from 'expo-router';
import { useDeferredValue, useMemo, useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

import { FilterRow } from '@/components/activity/filter-row';
import { FlowCard } from '@/components/activity/flow-card';
import { PagedTransactions } from '@/components/activity/paged-transactions';
import { ReviewStrip } from '@/components/activity/review-strip';
import { useTabBarClearance } from '@/components/nav/tab-bar';
import { SyncBanner } from '@/components/providers/sync-banner';
import { EmptyTile } from '@/components/ui/empty-tile';
import { useTransactionHold } from '@/components/transaction/use-transaction-hold';
import { HoldHint } from '@/components/ui/hold-menu';
import { Page, PageScroll, usePageContentTop } from '@/components/ui/page';
import { SearchField } from '@/components/ui/search-field';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/lib/auth/auth-context';
import {
  ACTIVITY_KIND_LABELS,
  filterActivity,
  withinRange,
  type ActivityKind,
  type ActivityRange,
} from '@/lib/finance/activity-filter';
import { flowSeries } from '@/lib/finance/flow-series';
import { useMainCurrency } from '@/lib/finance/main-currency';
import { merchantName } from '@/lib/finance/merchant-name';
import { usePageNumber } from '@/lib/finance/paged';
import {
  categoriesForUser$,
  pendingProposals$,
  transactions$,
  walletsForUser$,
} from '@/lib/finance/selectors';
import type { FinanceTransaction } from '@/lib/finance/types';
import { pickActivityRange } from '@/lib/sheet/pick-date';
import { openSheet } from '@/lib/sheet/sheet-store';
import { transactions$ as transactionTable$ } from '@/lib/store';
import { listMerchantAliases } from '@/lib/supabase/merchant-aliases';
import { isAwaitingReview } from '@/lib/supabase/proposed-transactions';
import { tid } from '@/lib/test-ids';
import type { RowLookups } from '@/lib/transactions/row';
import { compactWalletNames } from '@/lib/wallets/compact-name';
import { formatMoney } from '@repo/core';
import { deviceCalendar } from '@/lib/dates/device-calendar';

export default function ActivityScreen() {
  const scroll = useRef<ScrollView>(null);
  useScrollToTop(scroll);
  const { user } = useAuth();
  const reduceMotion = useReducedMotion();
  const contentTop = usePageContentTop();
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
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState<ActivityKind>('all');
  const [walletIds, setWalletIds] = useState<readonly string[]>([]);
  const [range, setRange] = useState<ActivityRange | null>(null);
  const searched = useDeferredValue(query);
  const listTop = useRef(0);
  const now = new Date();
  const today = deviceCalendar.dayKey(now);

  const lookups = useMemo<RowLookups>(
    () => ({
      categoriesById: Object.fromEntries(
        categories.map((category) => [category.id, category]),
      ),
      walletNames: compactWalletNames(wallets),
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
  const mainWallets = wallets.filter((wallet) => wallet.currency === currency);
  const shownWalletIds = useMemo(
    () =>
      walletIds.filter((id) =>
        wallets.some((wallet) => wallet.id === id && wallet.currency === currency),
      ),
    [walletIds, wallets, currency],
  );
  const walletLabel =
    shownWalletIds.length === 0
      ? 'All wallets'
      : shownWalletIds.length === 1
        ? lookups.walletNames[shownWalletIds[0]]
        : `${shownWalletIds.length} wallets`;
  const matching = useMemo(
    () =>
      filterActivity(named, {
        query: searched,
        walletIds: shownWalletIds,
        mainCurrency: currency,
        kind,
        categoryNames: Object.fromEntries(
          categories.map((category) => [category.id, category.name]),
        ),
      }),
    [named, searched, shownWalletIds, currency, kind, categories],
  );
  const listed = useMemo(() => withinRange(matching, range), [matching, range]);
  const series = useMemo(
    () => flowSeries({ transactions: matching, range, now: deviceCalendar.startOfDay(today), currency }),
    [matching, range, today, currency],
  );
  const [page, setPage] = usePageNumber(
    JSON.stringify([searched, shownWalletIds, kind, range, currency]),
  );
  const waiting = proposals.filter((proposal) => isAwaitingReview(proposal, new Date()));
  const reviewTotal = waiting
    .filter((proposal) => proposal.currency === currency)
    .reduce((sum, proposal) => sum + Number(proposal.amountMinor ?? 0), 0);

  const pickKind = async () => {
    const picked = await openSheet({ kind: 'activityKind', selected: kind });
    if (picked) setKind(picked);
  };

  const pickWallet = async () => {
    const picked = await openSheet({
      kind: 'wallets',
      title: 'Show wallets',
      wallets: mainWallets.map((wallet) => ({
        id: wallet.id,
        name: wallet.name,
        currency: wallet.currency,
        type: wallet.type,
        icon: wallet.icon,
        color: wallet.color,
        cardStyleId: wallet.cardStyleId,
      })),
      selectedIds: shownWalletIds,
    });
    if (picked) setWalletIds(picked.walletIds);
  };

  const open = (transaction: FinanceTransaction) =>
    transaction.debtActivityId
      ? router.navigate('/debts')
      : router.push({
          pathname: '/transaction/[id]',
          params: { id: transaction.id },
        });

  const pickRange = async () => {
    const picked = await pickActivityRange(range);
    if (picked) setRange(picked.range);
  };

  const turnPage = (next: number) => {
    setPage(next);
    scroll.current?.scrollTo({ y: contentTop + listTop.current, animated: !reduceMotion });
  };

  return (
    <Page
      headerScrolls
      screen="activity"
      kind="tabRoot"
      title="Activity"
      trailing={
        waiting.length ? (
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
        ) : null
      }
    >
      <PageScroll
        ref={scroll}
        keyboardShouldPersistTaps="handled"
        contentContainerClassName="gap-3 px-screen"
        contentContainerStyle={{ paddingBottom: clearance }}
      >
        {loaded && inCurrency.length > 0 ? (
          <SearchField
            compact
            testID={tid('activity', 'search')}
            accessibilityLabel="Search transactions"
            placeholder="Search merchant, note or amount"
            value={query}
            onChangeText={setQuery}
          />
        ) : null}
        <SyncBanner screen="activity" />
        {!loaded ? (
          <Skeleton rows={4} />
        ) : inCurrency.length === 0 ? (
          <EmptyTile
            mood="neutral"
            title="No spending yet"
            body="Add your first spend with +, or link an app on a wallet so Moni catches them for you."
            action={{
              testID: tid('activity', 'empty', 'link'),
              label: 'Link an app',
              icon: 'wallet-outline',
              onPress: () => router.push('/wallets'),
            }}
          />
        ) : (
          <>
            <FilterRow
              rangeLabel={series.label}
              rangeActive={range !== null}
              onRange={() => void pickRange()}
              onClearRange={() => setRange(null)}
              kindLabel={ACTIVITY_KIND_LABELS[kind]}
              kindActive={kind !== 'all'}
              onKind={() => void pickKind()}
              walletLabel={walletLabel}
              walletActive={shownWalletIds.length > 0}
              onWallet={() => void pickWallet()}
            />
            <FlowCard
              series={series}
              currency={currency}
              now={now}
            />
            <View
              className="gap-3.5"
              onLayout={(event) => {
                listTop.current = event.nativeEvent.layout.y;
              }}
            >
              <HoldHint screen="activity" />
              {listed.length === 0 ? (
                <EmptyTile
                  mood="thinking"
                  title={
                    searched.trim()
                      ? `No matches for "${searched.trim()}"`
                      : range
                        ? 'Nothing like that in these dates'
                        : 'Nothing matches'
                  }
                  body={
                    searched.trim()
                      ? 'Try a merchant, a category or an amount like 18.90.'
                      : 'Try another filter or other dates.'
                  }
                  action={
                    searched.trim()
                      ? {
                          testID: tid('activity', 'clear-search'),
                          label: 'Clear search',
                          onPress: () => setQuery(''),
                        }
                      : undefined
                  }
                />
              ) : (
                <PagedTransactions
                  screen="activity"
                  transactions={listed}
                  lookups={lookups}
                  currency={currency}
                  now={now}
                  page={page}
                  onPage={turnPage}
                  onOpen={open}
                  holdFor={hold.holdFor}
                />
              )}
            </View>
          </>
        )}
      </PageScroll>

      {hold.menu}
    </Page>
  );
}
