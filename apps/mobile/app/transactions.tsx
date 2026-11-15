import { useValue } from '@legendapp/state/react';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useRef } from 'react';
import { ScrollView, View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

import { PagedTransactions } from '@/components/activity/paged-transactions';
import { useTransactionHold } from '@/components/transaction/use-transaction-hold';
import { EmptyTile, NotFound } from '@/components/ui/empty-tile';
import { HoldHint } from '@/components/ui/hold-menu';
import { Page, PageScroll, usePageContentTop } from '@/components/ui/page';
import { useAuth } from '@/lib/auth/auth-context';
import { useMainCurrency } from '@/lib/finance/main-currency';
import { merchantName } from '@/lib/finance/merchant-name';
import { usePageNumber } from '@/lib/finance/paged';
import {
  categoriesForUser$,
  transactions$,
  walletsForUser$,
} from '@/lib/finance/selectors';
import { listMerchantAliases } from '@/lib/supabase/merchant-aliases';
import {
  readListScope,
  scopedRows,
  type ListParams,
  type ListScope,
} from '@/lib/transactions/list-scope';
import type { RowLookups } from '@/lib/transactions/row';
import { compactWalletNames } from '@/lib/wallets/compact-name';

/**
 * `/transactions`: a detail page's See all, pushed under it so Back returns there. The bill,
 * transaction, place and Categories pages open it; it lists their rows 20 a page.
 */
export default function TransactionsScreen() {
  const params = useLocalSearchParams<ListParams>();
  const key = JSON.stringify(params);
  // The params object is new on each render; its contents are what decide the scope.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const scope = useMemo(() => readListScope(params), [key]);
  const title = params.title || 'Transactions';
  if (!scope)
    return (
      <Page
        screen="list"
        kind="pushed"
        title={title}
      >
        <NotFound
          icon="format-list-bulleted"
          title="These transactions are gone"
          body="Go back and open the list again."
        />
      </Page>
    );
  return (
    <ScopedList
      title={title}
      scope={scope}
    />
  );
}

function ScopedList({ title, scope }: { title: string; scope: ListScope }) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const all = useValue(transactions$({ userId }));
  const wallets = useValue(walletsForUser$(userId));
  const categories = useValue(categoriesForUser$(userId));
  const aliases = useValue(() => (userId ? listMerchantAliases(userId) : []));
  const mainCurrency = useMainCurrency();
  const now = new Date();
  const scroll = useRef<ScrollView>(null);
  const listY = useRef(0);
  const reduceMotion = useReducedMotion();
  const contentTop = usePageContentTop();
  const hold = useTransactionHold('list');
  const [page, setPage] = usePageNumber(JSON.stringify(scope));
  const { rows, currency } = useMemo(
    () => scopedRows(scope, all, mainCurrency, new Date()),
    [scope, all, mainCurrency],
  );
  const named = useMemo(
    () =>
      rows.map((row) =>
        row.merchant ? { ...row, merchant: merchantName(row.merchant, aliases) } : row,
      ),
    [rows, aliases],
  );
  const lookups = useMemo<RowLookups>(
    () => ({
      categoriesById: Object.fromEntries(categories.map((category) => [category.id, category])),
      walletNames: compactWalletNames(wallets),
    }),
    [categories, wallets],
  );
  const turnPage = (next: number) => {
    setPage(next);
    scroll.current?.scrollTo({ y: contentTop + listY.current, animated: !reduceMotion });
  };

  return (
    <Page
      headerScrolls
      screen="list"
      kind="pushed"
      title={title}
      subtitle={rows.length === 1 ? '1 transaction' : `${rows.length} transactions`}
    >
      <PageScroll
        ref={scroll}
        className="flex-1"
        contentContainerClassName="gap-3 px-5 pb-8"
        showsVerticalScrollIndicator={false}
      >
        {named.length ? (
          <View
            className="gap-3.5"
            onLayout={(event) => {
              listY.current = event.nativeEvent.layout.y;
            }}
          >
            <HoldHint screen="list" />
            <PagedTransactions
              screen="list"
              transactions={named}
              lookups={lookups}
              currency={currency}
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
          </View>
        ) : (
          <EmptyTile
            icon="format-list-bulleted"
            tone="quiet"
            title="Nothing here any more"
            body="These transactions were moved or deleted."
          />
        )}
      </PageScroll>
      {hold.menu}
    </Page>
  );
}
