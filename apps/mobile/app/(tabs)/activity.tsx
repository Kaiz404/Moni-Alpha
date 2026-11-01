import { syncState } from '@legendapp/state';
import { useSelector, useValue } from '@legendapp/state/react';
import { router, useLocalSearchParams, useNavigation, useScrollToTop } from 'expo-router';
import type { NavigationProp } from 'expo-router/react-navigation';
import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

import {
  CLEARED_LINK,
  inScope,
  readActivityLink,
  scopeLabel,
  type ActivityLinkParams,
  type ActivityScope,
} from '@/components/activity/activity-link';
import { FilterChips } from '@/components/activity/filter-chips';
import { FlowCard } from '@/components/activity/flow-card';
import { PagedTransactions } from '@/components/activity/paged-transactions';
import { ReviewStrip } from '@/components/activity/review-strip';
import { useTabBarClearance } from '@/components/nav/tab-bar';
import { SyncBanner } from '@/components/providers/sync-banner';
import { EmptyTile } from '@/components/ui/empty-tile';
import { MoniButton } from '@/components/ui/header-icon-button';
import { useTransactionHold } from '@/components/transaction/use-transaction-hold';
import { HoldHint } from '@/components/ui/hold-menu';
import { Page } from '@/components/ui/page';
import { SearchField } from '@/components/ui/search-field';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { useAuth } from '@/lib/auth/auth-context';
import { toLocalDateInput } from '@/lib/dates/local-date-input';
import {
  filterActivity,
  localDay,
  withinRange,
  type ActivityKind,
  type ActivityRange,
} from '@/lib/finance/activity-filter';
import { flowSeries } from '@/lib/finance/flow-series';
import { formatMoney } from '@/lib/finance/format-money';
import { useMainCurrency } from '@/lib/finance/main-currency';
import { merchantName } from '@/lib/finance/merchant-name';
import { usePageNumber } from '@/lib/finance/paged';
import { groupPlaces, placeRange } from '@/lib/finance/places';
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

export default function ActivityScreen() {
  const scroll = useRef<ScrollView>(null);
  useScrollToTop(scroll);
  const { user } = useAuth();
  const reduceMotion = useReducedMotion();
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
  const params = useLocalSearchParams<ActivityLinkParams>();
  const navigation = useNavigation<NavigationProp<{ activity: ActivityLinkParams }, 'activity'>>();
  const [scope, setScope] = useState<ActivityScope | null>(null);
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState<ActivityKind>('all');
  const [walletId, setWalletId] = useState<string | null>(null);
  const [range, setRange] = useState<ActivityRange | null>(null);
  const searched = useDeferredValue(query);
  const listTop = useRef(0);
  const now = new Date();
  const today = toLocalDateInput(now);

  // A link from another page replaces whatever filters were left, then clears its params so the same link works again.
  useEffect(() => {
    const link = readActivityLink(params);
    if (!link) return;
    setQuery(link.query);
    setScope(link.scope);
    setKind('all');
    setWalletId(null);
    setRange(link.range);
    navigation.setParams(CLEARED_LINK);
  }, [navigation, params]);

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
  const shownPlace = useMemo(
    () =>
      scope?.kind === 'place'
        ? (groupPlaces(named, {
            currency,
            range: scope.range ? placeRange(scope.range, new Date()) : null,
          }).find((candidate) => candidate.id === scope.placeId) ?? null)
        : null,
    [named, scope, currency],
  );
  const scoped = useMemo(
    () =>
      shownPlace
        ? shownPlace.transactions
        : scope && scope.kind !== 'place'
          ? named.filter((transaction) => inScope(transaction, scope))
          : named,
    [named, shownPlace, scope],
  );
  const chipLabel = shownPlace
    ? shownPlace.name
    : scope && scope.kind !== 'place'
      ? scopeLabel(
          scope,
          scope.kind === 'category'
            ? (categories.find((category) => category.id === scope.categoryId)?.name ?? null)
            : null,
        )
      : null;
  const matching = useMemo(
    () =>
      filterActivity(scoped, {
        query: searched,
        walletId,
        mainCurrency: currency,
        kind,
        categoryNames: Object.fromEntries(
          categories.map((category) => [category.id, category.name]),
        ),
      }),
    [scoped, searched, walletId, currency, kind, categories],
  );
  const listed = useMemo(() => withinRange(matching, range), [matching, range]);
  const series = useMemo(
    () => flowSeries({ transactions: matching, range, now: localDay(today), currency }),
    [matching, range, today, currency],
  );
  const [page, setPage] = usePageNumber(
    JSON.stringify([searched, walletId, kind, range, scope, currency]),
  );
  const waiting = proposals.filter((proposal) => isAwaitingReview(proposal, new Date()));
  const reviewTotal = waiting
    .filter((proposal) => proposal.currency === currency)
    .reduce((sum, proposal) => sum + Number(proposal.amountMinor ?? 0), 0);
  const mainWallets = wallets.filter(
    (wallet) => wallet.currency === currency,
  );
  const walletName =
    mainWallets.some((wallet) => wallet.id === walletId) && walletId
      ? lookups.walletNames[walletId]
      : null;

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

  const pickRange = async () => {
    const picked = await pickActivityRange(range);
    if (picked) setRange(picked.range);
  };

  const turnPage = (next: number) => {
    setPage(next);
    scroll.current?.scrollTo({ y: listTop.current, animated: !reduceMotion });
  };

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
      {loaded && inCurrency.length > 0 ? (
        <View className="px-screen pb-3">
          <SearchField
            compact
            testID={tid('activity', 'search')}
            accessibilityLabel="Search transactions"
            placeholder="Search merchant, note or amount"
            value={query}
            onChangeText={setQuery}
          />
        </View>
      ) : null}
      <ScrollView
        ref={scroll}
        keyboardShouldPersistTaps="handled"
        contentContainerClassName="gap-3 px-screen"
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
            <FlowCard
              series={series}
              range={range}
              currency={currency}
              now={now}
              onPickRange={() => void pickRange()}
              onClearRange={() => setRange(null)}
              onNarrow={(bucket) => setRange({ from: bucket.from, to: bucket.to })}
            />
            <FilterChips
              kind={kind}
              onKind={setKind}
              walletName={walletName}
              scope={chipLabel && scope ? { kind: scope.kind, label: chipLabel } : null}
              onClearScope={() => setScope(null)}
              onWallet={() => void pickWallet()}
            />
            <View
              className="gap-3.5"
              onLayout={(event) => {
                listTop.current = event.nativeEvent.layout.y;
              }}
            >
              <HoldHint screen="activity" />
              {listed.length === 0 ? (
                <View className="items-center gap-1 rounded-tile border-[1.5px] border-dashed border-hairline px-[18px] py-5">
                  <Text variant="rowTitle" className="text-center text-foreground">
                    {searched.trim()
                      ? `No matches for "${searched.trim()}"`
                      : range
                        ? 'Nothing like that in these dates'
                        : 'Nothing matches'}
                  </Text>
                  <Text variant="meta" className="text-center text-muted">
                    {searched.trim()
                      ? 'Try a merchant, a category or an amount like 18.90.'
                      : 'Try another filter or other dates.'}
                  </Text>
                </View>
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
      </ScrollView>

      {hold.menu}
    </Page>
  );
}
