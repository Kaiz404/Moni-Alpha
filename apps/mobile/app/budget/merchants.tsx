import { useLocalSearchParams } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';
import Animated, { LayoutAnimationConfig, useReducedMotion } from 'react-native-reanimated';

import { Pager } from '@/components/activity/paged-transactions';
import { MerchantSpendRow } from '@/components/budget/merchant-list';
import { openSpending } from '@/components/budget/open-spending';
import { useBudgetData } from '@/components/budget/use-budget';
import { EmptyTile } from '@/components/ui/empty-tile';
import { ListCard } from '@/components/ui/list-card';
import { ListItemMotion, listSettle } from '@/components/ui/list-motion';
import { Page, PageScroll, usePageContentTop } from '@/components/ui/page';
import { SearchField } from '@/components/ui/search-field';
import { Text } from '@/components/ui/text';
import { deviceCalendar } from '@/lib/dates/device-calendar';
import { pageOf, usePageNumber } from '@/lib/finance/paged';
import { tid } from '@/lib/test-ids';
import { isMonthKey, monthMerchants, monthName } from '@repo/core';

/**
 * Budget's merchant count: every merchant a month's spending went to, 20 a page, each row opening
 * its payments under Budget. Naming bank codes lives on Profile's Merchant names (#140).
 */
export default function BudgetMerchantsScreen() {
  const params = useLocalSearchParams<{ month?: string }>();
  const data = useBudgetData();
  const [query, setQuery] = useState('');
  const scroll = useRef<ScrollView>(null);
  const listY = useRef(0);
  const reduceMotion = useReducedMotion();
  const contentTop = usePageContentTop();

  const thisMonth = deviceCalendar.monthKey(data.now);
  const month = isMonthKey(params.month) ? params.month : thisMonth;
  const year = month.slice(0, 4);
  const monthLabel =
    year === thisMonth.slice(0, 4) ? monthName(month) : `${monthName(month)} ${year}`;
  const { transactions, currency, everyCategory, aliases, walletNames } = data;
  const merchants = useMemo(
    () =>
      monthMerchants({
        month,
        currency,
        transactions,
        categories: everyCategory,
        aliases,
        calendar: deviceCalendar,
      }),
    [month, currency, transactions, everyCategory, aliases],
  );

  const words = query.trim().toLowerCase();
  const spent = words
    ? merchants.filter((merchant) => merchant.name.toLowerCase().includes(words))
    : merchants;
  const [page, setPage] = usePageNumber(JSON.stringify([month, words]));
  const current = pageOf(spent, page);
  const turnPage = (next: number) => {
    setPage(next);
    scroll.current?.scrollTo({ y: contentTop + listY.current, animated: !reduceMotion });
  };

  return (
    <Page
      headerScrolls
      screen="merchants"
      kind="pushed"
      title="Merchants"
    >
      <PageScroll
        ref={scroll}
        className="flex-1"
        contentContainerClassName="gap-5 px-5 pb-10"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {merchants.length ? (
          <SearchField
            compact
            testID={tid('merchants', 'search')}
            accessibilityLabel="Search merchants"
            placeholder="Search a merchant"
            value={query}
            onChangeText={setQuery}
          />
        ) : null}

        {!merchants.length ? (
          <EmptyTile
            icon="storefront-outline"
            tone="quiet"
            title={`Nothing spent in ${monthLabel}`}
            body="Pick another month on Budget."
          />
        ) : !spent.length ? (
          <EmptyTile
            mood="thinking"
            title={`No matches for "${query.trim()}"`}
            body="Try part of a name."
            action={{
              testID: tid('merchants', 'clear-search'),
              label: 'Clear search',
              onPress: () => setQuery(''),
            }}
          />
        ) : (
          <View
            className="gap-2.5"
            onLayout={(event) => {
              listY.current = event.nativeEvent.layout.y;
            }}
          >
            <Text
              testID={tid('merchants', 'month', 'label')}
              variant="caps"
              className="pl-1 text-muted"
              accessibilityRole="header"
            >
              {`${spent.length} ${spent.length === 1 ? 'merchant' : 'merchants'} in ${monthLabel}`}
            </Text>
            {/* Turning the page swaps every row at once, so the old rows leave without animating. */}
            <LayoutAnimationConfig
              key={current.page}
              skipExiting
            >
              <ListCard settles>
                {current.rows.map((merchant) => (
                  <ListItemMotion key={merchant.name}>
                    <MerchantSpendRow
                      screen="merchants"
                      merchant={merchant}
                      icon={merchant.icon}
                      color={merchant.color}
                      currency={currency}
                      walletNames={walletNames}
                      onOpen={() => openSpending({ kind: 'merchant', name: merchant.name }, month)}
                      codeKey={null}
                    />
                  </ListItemMotion>
                ))}
              </ListCard>
              <Animated.View layout={listSettle}>
                <Pager
                  screen="merchants"
                  page={current}
                  onPage={turnPage}
                  of="merchants"
                />
              </Animated.View>
            </LayoutAnimationConfig>
          </View>
        )}
      </PageScroll>
    </Page>
  );
}
