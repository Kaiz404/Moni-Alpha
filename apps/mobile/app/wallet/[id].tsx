import { useValue } from '@legendapp/state/react';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef } from 'react';
import { ScrollView, View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

import { PagedTransactions } from '@/components/activity/paged-transactions';
import { useNow } from '@/components/budget/use-budget';
import { useTransactionHold } from '@/components/transaction/use-transaction-hold';
import { NotFound } from '@/components/ui/empty-tile';
import { HoldHint } from '@/components/ui/hold-menu';
import { Page, PageScroll, usePageContentTop } from '@/components/ui/page';
import { Text } from '@/components/ui/text';
import { WalletBalanceChart } from '@/components/wallets/wallet-balance-chart';
import { WalletHero } from '@/components/wallets/wallet-hero';
import { WalletMenu } from '@/components/wallets/wallet-menu';
import { ReviewStrip } from '@/components/wallets/wallet-sections';
import { useAuth } from '@/lib/auth/auth-context';
import { useMainCurrency } from '@/lib/finance/main-currency';
import { merchantName } from '@repo/core';
import { usePageNumber } from '@/lib/finance/paged';
import { categoriesForUser$, pendingProposals$, transactions$, walletBalanceMinor$, walletById$, walletsForUser$ } from '@/lib/finance/selectors';
import { listMerchantAliases } from '@/lib/supabase/merchant-aliases';
import type { RowLookups } from '@/lib/transactions/row';
import { compactWalletNames } from '@/lib/wallets/compact-name';
import { confirmDeleteWallet } from '@/lib/wallets/delete-wallet';
import { useWalletAlertLink } from '@/lib/wallets/wallet-link';

/**
 * V2H-WalletDetail at `/wallet/<id>`, for looking: the balance, the month chart, and the wallet's
 * transactions a page at a time. Its settings live on Edit wallet. `?edit=balance` opens it with
 * the balance sheet up: the Home check-in's Fix it uses it.
 */
export default function WalletScreen() {
  const params = useLocalSearchParams<{
    id?: string;
    edit?: string;
  }>();
  const id = params.id ?? '';
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const wallet = useValue(walletById$(id));
  const balanceMinor = useValue(walletBalanceMinor$(id));
  const link = useWalletAlertLink(id);
  const transactions = useValue(
    transactions$({ userId, walletId: id }),
  );
  const proposals = useValue(pendingProposals$(userId));
  const wallets = useValue(walletsForUser$(userId));
  const categories = useValue(categoriesForUser$(userId));
  const aliases = useValue(() => (userId ? listMerchantAliases(userId) : []));
  const now = useNow();
  const mainCurrency = useMainCurrency();
  const scroll = useRef<ScrollView>(null);
  const listY = useRef(0);
  const reduceMotion = useReducedMotion();
  const contentTop = usePageContentTop();
  const hold = useTransactionHold('wallet');
  const [page, setPage] = usePageNumber(id);
  const turnPage = (next: number) => {
    setPage(next);
    scroll.current?.scrollTo({ y: contentTop + listY.current, animated: !reduceMotion });
  };
  const named = useMemo(
    () =>
      transactions.map((transaction) =>
        transaction.merchant
          ? { ...transaction, merchant: merchantName(transaction.merchant, aliases) }
          : transaction,
      ),
    [transactions, aliases],
  );

  const lookups = useMemo<RowLookups>(
    () => ({
      categoriesById: Object.fromEntries(
        categories.map((category) => [category.id, category]),
      ),
      walletNames: compactWalletNames(wallets),
    }),
    [categories, wallets],
  );
  const waiting = useMemo(
    () =>
      proposals.filter(
        (proposal) =>
          proposal.walletId === id &&
          proposal.currency === wallet?.currency,
      ),
    [id, proposals, wallet?.currency],
  );

  // The page closes itself once its wallet is deleted, here, from Edit wallet, or on another phone.
  const seen = useRef(false);
  useEffect(() => {
    if (wallet) seen.current = true;
    else if (seen.current && router.canGoBack()) router.back();
  }, [wallet]);

  if (!wallet) {
    return (
      <Page
        screen="wallet"
        kind="pushed"
        title="Wallet"
      >
        <NotFound
          icon="wallet"
          title="This wallet isn't here any more"
          body="It may have been deleted on another phone."
        />
      </Page>
    );
  }

  const ownRows = transactions.filter(
    (transaction) => transaction.walletId === wallet.id,
  ).length;

  return (
    <Page
      headerScrolls
      screen="wallet"
      kind="pushed"
      title="Wallet"
      trailing={
        <WalletMenu
          walletName={wallet.name}
          onEdit={() =>
            router.push({
              pathname: '/wallet/edit',
              params: { id: wallet.id },
            })
          }
          onDelete={() => void confirmDeleteWallet(wallet, ownRows)}
        />
      }
    >
      <PageScroll
        ref={scroll}
        className="flex-1"
        contentContainerClassName="gap-3.5 px-5 pb-10"
        showsVerticalScrollIndicator={false}
      >
        <WalletHero
          key={wallet.id}
          wallet={wallet}
          balanceMinor={balanceMinor}
          link={link}
          openBalance={params.edit === 'balance'}
        />
        {wallet.currency === mainCurrency ? (
          <WalletBalanceChart
            wallet={wallet}
            balanceMinor={Number(balanceMinor)}
            transactions={transactions}
            now={now}
          />
        ) : null}
        <ReviewStrip
          proposals={waiting}
          currency={wallet.currency}
        />
        <View
          className="gap-2 pt-2"
          onLayout={(event) => {
            listY.current = event.nativeEvent.layout.y;
          }}
        >
          <Text
            variant="sectionTitle"
            className="text-foreground"
            accessibilityRole="header"
          >
            Transactions
          </Text>
          {named.length === 0 ? (
            <Text
              variant="body"
              className="px-1 text-ink-2"
            >
              Nothing in this wallet yet. Add spending with + or tell Moni.
            </Text>
          ) : (
            <>
              <HoldHint screen="wallet" />
              <PagedTransactions
                screen="wallet"
                transactions={named}
                lookups={lookups}
                currency={wallet.currency}
                now={now}
                page={page}
                onPage={turnPage}
                onOpen={(transaction) =>
                  router.push({
                    pathname: '/transaction/[id]',
                    params: { id: transaction.id },
                  })
                }
                holdFor={hold.holdFor}
              />
            </>
          )}
        </View>
      </PageScroll>
      {hold.menu}
    </Page>
  );
}
