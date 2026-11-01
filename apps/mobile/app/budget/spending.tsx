import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useRef } from 'react';
import { ScrollView, View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

import { PagedTransactions } from '@/components/activity/paged-transactions';
import { useBudgetData, type BudgetData } from '@/components/budget/use-budget';
import { useTransactionHold } from '@/components/transaction/use-transaction-hold';
import { EmptyTile, NotFound } from '@/components/ui/empty-tile';
import { HoldHint } from '@/components/ui/hold-menu';
import { Page } from '@/components/ui/page';
import { Text } from '@/components/ui/text';
import { TintBubble } from '@/components/ui/transaction-row';
import { formatDate } from '@/lib/dates/day-label';
import { parseLocalDateInput } from '@/lib/dates/local-date-input';
import { monthKey, monthName, type MonthKey } from '@/lib/finance/budget-month';
import { formatMoney } from '@/lib/finance/format-money';
import { usePageNumber } from '@/lib/finance/paged';
import {
  NO_CATEGORY_NAME,
  readSpendingParams,
  spendingChange,
  spendingRows,
  totalMinor,
  type SpendingParams,
  type SpendingScope,
} from '@/lib/reports/report';
import { tid } from '@/lib/test-ids';
import { resolveTransactionIcon } from '@/lib/transactions/icon';
import type { RowLookups } from '@/lib/transactions/row';

/** A Budget row's payments, one page at a time. Sits under the Budget tab, not in Activity. */
export default function SpendingScreen() {
  const params = useLocalSearchParams<SpendingParams>();
  const data = useBudgetData();
  const link = readSpendingParams(params, monthKey(data.now));
  if (!link)
    return (
      <Page
        screen="budget"
        kind="pushed"
        title="Budget"
      >
        <NotFound
          icon="chart-box"
          title="These payments are gone"
          body="Go back to Budget and pick a row."
        />
      </Page>
    );
  return (
    <Spending
      scope={link.scope}
      month={link.month}
      data={data}
    />
  );
}

function Spending({
  scope,
  month,
  data,
}: {
  scope: SpendingScope;
  month: MonthKey;
  data: BudgetData;
}) {
  const { transactions, currency, aliases, now, everyCategory, walletNames } = data;
  const scroll = useRef<ScrollView>(null);
  const listY = useRef(0);
  const reduceMotion = useReducedMotion();
  const hold = useTransactionHold('budget');
  const [page, setPage] = usePageNumber(JSON.stringify([month, scope]));
  const rows = useMemo(
    () => spendingRows(scope, month, transactions, currency, aliases),
    [scope, month, transactions, currency, aliases],
  );
  const change = useMemo(
    () => spendingChange(scope, month, now, transactions, currency, aliases),
    [scope, month, now, transactions, currency, aliases],
  );
  const lookups = useMemo<RowLookups>(
    () => ({
      categoriesById: Object.fromEntries(everyCategory.map((item) => [item.id, item])),
      walletNames,
    }),
    [everyCategory, walletNames],
  );

  const categoryOf = (id: string | null | undefined) =>
    id ? lookups.categoriesById[id] : undefined;
  const category = categoryOf(scope.kind === 'category' ? scope.categoryId : rows[0]?.categoryId);
  const title =
    scope.kind === 'category'
      ? (category?.name ?? NO_CATEGORY_NAME)
      : scope.kind === 'merchant'
        ? scope.name
        : formatDate(parseLocalDateInput(scope.day) ?? now, now);
  const year = month.slice(0, 4);
  const monthLabel =
    year === monthKey(now).slice(0, 4) ? monthName(month) : `${monthName(month)} ${year}`;
  const meta = [
    scope.kind === 'day' ? null : monthLabel,
    scope.kind === 'merchant' ? categoryOf(scope.categoryId)?.name : null,
    rows.length === 1 ? '1 payment' : `${rows.length} payments`,
  ]
    .filter(Boolean)
    .join(' · ');
  const total = formatMoney(totalMinor(rows), currency);

  const turnPage = (next: number) => {
    setPage(next);
    scroll.current?.scrollTo({ y: listY.current, animated: !reduceMotion });
  };

  return (
    <Page
      screen="budget"
      kind="pushed"
      title={title}
    >
      <ScrollView
        ref={scroll}
        className="flex-1"
        contentContainerClassName="gap-3 px-5 pb-8"
        showsVerticalScrollIndicator={false}
      >
        <View className="gap-2 rounded-card bg-card px-[18px] py-3.5">
          <View className="flex-row items-center gap-3.5">
            {scope.kind === 'day' ? null : (
              <TintBubble
                icon={resolveTransactionIcon(category?.icon ?? null, 'expense')}
                color={category?.color ?? null}
              />
            )}
            <View className="min-w-0 flex-1">
              <Text
                testID={tid('budget', 'spending', 'total')}
                variant="sectionTitle"
                className="text-foreground"
                style={{ fontVariant: ['tabular-nums'] }}
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                {total}
              </Text>
              <Text
                testID={tid('budget', 'spending', 'meta')}
                variant="meta"
                className="text-ink-2"
                numberOfLines={1}
              >
                {meta}
              </Text>
            </View>
          </View>
          {change ? (
            <Text
              testID={tid('budget', 'spending', 'change')}
              variant="meta"
              className="text-ink-2"
              numberOfLines={1}
            >
              {change}
            </Text>
          ) : null}
        </View>
        {rows.length ? (
          <View
            className="gap-3.5"
            onLayout={(event) => {
              listY.current = event.nativeEvent.layout.y;
            }}
          >
            <HoldHint screen="budget" />
            <PagedTransactions
              screen="budget"
              transactions={rows}
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
            title="No payments left here"
            body={`Nothing counts here in ${monthLabel} any more.`}
          />
        )}
      </ScrollView>
      {hold.menu}
    </Page>
  );
}
