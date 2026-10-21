import { syncState } from '@legendapp/state';
import { useValue } from '@legendapp/state/react';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';

import { AskBox } from '@/components/home/ask-box';
import { BillsStrip } from '@/components/home/bills-strip';
import { CheckInCard } from '@/components/home/check-in-card';
import { NetWorth } from '@/components/home/net-worth';
import { RecentList } from '@/components/home/recent-list';
import { ReviewBlock } from '@/components/home/review-block';
import { SetupTiles, type SetupStep } from '@/components/home/setup-tiles';
import { SpentCard } from '@/components/home/spent-card';
import { debtPhrase } from '@/components/home/spent-summary';
import { useSpentSummary } from '@/components/home/use-spent-summary';
import { openCaptureChooser } from '@/components/nav/capture-chooser';
import { useTabBarClearance } from '@/components/nav/tab-bar';
import { SyncBanner } from '@/components/providers/sync-banner';
import { EmptyTile } from '@/components/ui/empty-tile';
import { Page } from '@/components/ui/page';
import { SKELETON_DELAY_MS } from '@/components/ui/skeleton';
import { useAuth } from '@/lib/auth/auth-context';
import { useMainCurrency } from '@/lib/finance/main-currency';
import { merchantName } from '@/lib/finance/merchant-name';
import { financeOverview$, pendingProposals$ } from '@/lib/finance/selectors';
import type { FinanceTransaction } from '@/lib/finance/types';
import { wallets$ } from '@/lib/store';
import { getRecordValues } from '@/lib/store/helpers';
import { listMerchantAliases } from '@/lib/supabase/merchant-aliases';
import { isAwaitingReview } from '@/lib/supabase/proposed-transactions';
import { tid } from '@/lib/test-ids';
import type { RowLookups } from '@/lib/transactions/row';

function timeAwareGreeting(now: Date): string {
  const hour = now.getHours();
  if (hour < 12) return 'Morning';
  if (hour < 18) return 'Afternoon';
  return 'Evening';
}

/** "Wednesday, 14 Oct", as the Home header draws it. */
function headerDate(date: Date): string {
  const part = (options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat('en-GB', options).format(date);
  return `${part({ weekday: 'long' })}, ${part({ day: 'numeric' })} ${part({ month: 'short' })}`;
}

function firstName(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? (trimmed.split(/\s+/)[0] ?? null) : null;
}

function openTransaction(transaction: FinanceTransaction) {
  if (transaction.debtActivityId) router.navigate('/debts');
  else
    router.push({
      pathname: '/transaction/[id]',
      params: { id: transaction.id },
    });
}

export default function HomeScreen() {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const clearance = useTabBarClearance();
  const currency = useMainCurrency();
  const now = new Date();

  const overview = useValue(financeOverview$(userId));
  const spent = useSpentSummary(userId, currency);
  const proposals = useValue(pendingProposals$(userId));
  const aliases = useValue(() => (userId ? listMerchantAliases(userId) : []));
  const alertsLinked = useValue(() =>
    getRecordValues<{ deleted?: boolean; notification_package: string | null }>(
      wallets$,
    ).some((wallet) => !wallet.deleted && wallet.notification_package),
  );
  const firstSync = useValue(
    () => !syncState(wallets$).isLoaded.get(),
  );
  const [refreshing, setRefreshing] = useState(false);

  const name =
    firstName(user?.user_metadata?.full_name) ?? firstName(user?.email);
  const initial = (name ?? user?.email ?? '?').charAt(0).toUpperCase();
  const mainWallets = overview.wallets.filter(
    (wallet) => wallet.currency === currency,
  );
  const netWorthMinor = mainWallets.reduce(
    (sum, wallet) => sum + Number(overview.balancesByWallet[wallet.id] ?? 0),
    0,
  );
  const firstRun =
    overview.wallets.length === 0 && overview.transactions.length === 0;
  const waiting = proposals.filter((proposal) =>
    isAwaitingReview(proposal, now),
  );
  const recent = useMemo(
    () =>
      overview.transactions
        .filter((transaction) => transaction.currency === currency)
        .slice(0, 3)
        .map((transaction) => ({
          ...transaction,
          merchant: merchantName(transaction.merchant, aliases),
        })),
    [overview.transactions, currency, aliases],
  );
  const lookups = useMemo<RowLookups>(
    () => ({
      categoriesById: overview.categoriesById,
      walletNames: Object.fromEntries(
        overview.wallets.map((wallet) => [wallet.id, wallet.name]),
      ),
    }),
    [overview.categoriesById, overview.wallets],
  );
  const steps: SetupStep[] = [
    {
      key: 'wallet',
      title: 'Add a wallet',
      body: 'Bank, cash, e-wallet or card',
      done: overview.wallets.length > 0,
      onPress: () => router.push('/wallet/new'),
    },
    {
      key: 'budget',
      title: `Set ${monthLong(now)}'s budget`,
      body: 'This draws your spending chart',
      done: spent.budgetMinor !== null,
      onPress: () => router.push('/budget/form'),
    },
    {
      key: 'alerts',
      title: 'Let Moni read bank alerts',
      body: 'Optional. Spending lands here by itself',
      done: alertsLinked,
      onPress: () => router.push('/notifications'),
    },
  ];
  const showSetup =
    overview.transactions.length === 0 && steps.some((step) => !step.done);
  const debtsLabel = spent.bills.length
    ? null
    : debtPhrase(spent.debtsDue, currency);

  const refresh = async () => {
    setRefreshing(true);
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => resolve()),
    );
    setRefreshing(false);
  };

  return (
    <Page
      screen="home"
      kind="home"
      initial={initial}
      date={headerDate(now)}
      greeting={
        firstRun
          ? `Welcome to Moni${name ? `, ${name}` : ''}`
          : `${timeAwareGreeting(now)}${name ? `, ${name}` : ''}`
      }
      onAvatarPress={() => router.push('/profile')}
      onAskMoni={() => router.push('/chat')}
    >
      {firstSync && firstRun ? (
        <HomeSkeleton />
      ) : (
        <ScrollView
          className="flex-1"
          contentContainerClassName="gap-3 px-5"
          contentContainerStyle={{ paddingBottom: clearance }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={refresh}
            />
          }
          showsVerticalScrollIndicator={false}
        >
          <SyncBanner screen="home" />
          <NetWorth
            amountMinor={netWorthMinor}
            currency={currency}
            firstRun={firstRun}
            onPress={() => router.push('/wallets')}
          />
          {showSetup ? <SetupTiles steps={steps} /> : null}
          <SpentCard
            summary={spent}
            currency={currency}
            after={debtsLabel}
          />
          <AskBox onPress={() => router.push('/chat')} />
          <ReviewBlock
            proposals={waiting}
            currency={currency}
            onPress={() =>
              router.push({
                pathname: '/proposal/[id]',
                params: { id: waiting[0]!.id },
              })
            }
          />
          <View className="h-1" />
          <RecentList
            transactions={recent}
            lookups={lookups}
            onOpen={openTransaction}
            onSeeAll={() => router.navigate('/activity')}
            onAdd={() => void openCaptureChooser()}
          />
          {firstRun ? (
            <EmptyTile
              icon="calendar-clock"
              title="No bills yet"
              body="Each bill shows here a few days before it's due."
              action={{
                testID: tid('home', 'bills', 'add'),
                label: 'Add a bill',
                icon: 'plus',
                onPress: () => router.navigate('/budget'),
              }}
            />
          ) : (
            <BillsStrip
              summary={spent}
              currency={currency}
              now={now}
              onPress={() => router.navigate('/budget')}
            />
          )}
          <CheckInCard currency={currency} />
        </ScrollView>
      )}
    </Page>
  );
}

function monthLong(date: Date): string {
  return date.toLocaleDateString('en-GB', { month: 'long' });
}

/** First sync on a new phone only, after 300 ms; shapes follow the real layout. */
function HomeSkeleton() {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setShown(true), SKELETON_DELAY_MS);
    return () => clearTimeout(timer);
  }, []);
  if (!shown) return null;
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel="Loading"
      className="gap-3 px-5"
    >
      <View className="h-3 w-24 rounded-full bg-sand-light" />
      <View className="h-12 w-56 rounded-full bg-sand-light" />
      <View className="h-[300px] rounded-card bg-card p-[18px]">
        <View className="h-3 w-32 rounded-full bg-sand-light" />
        <View className="mt-4 h-8 w-44 rounded-full bg-sand-light" />
        <View className="mt-4 flex-1 rounded-tile bg-sand-light" />
      </View>
      <View className="h-12 rounded-full bg-card" />
      <View className="h-[200px] rounded-card bg-card" />
    </View>
  );
}
