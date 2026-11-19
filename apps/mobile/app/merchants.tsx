import { useLocalSearchParams } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';
import Animated, { LayoutAnimationConfig, useReducedMotion } from 'react-native-reanimated';

import { Pager } from '@/components/activity/paged-transactions';
import { MerchantSpendRow } from '@/components/budget/merchant-list';
import { openSpending } from '@/components/budget/open-spending';
import { useBudgetData } from '@/components/budget/use-budget';
import { MerchantRow, type MerchantSection } from '@/components/merchants/merchant-row';
import { useMerchantNames, type MerchantRow as MerchantRowData } from '@/components/merchants/use-merchant-names';
import { EmptyTile } from '@/components/ui/empty-tile';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { InPlaceGroup, type Saved } from '@/components/ui/in-place-field';
import { ListCard, ListSection } from '@/components/ui/list-card';
import { ListItemMotion, listSettle } from '@/components/ui/list-motion';
import { Page, PageScroll, usePageContentTop } from '@/components/ui/page';
import { SearchField } from '@/components/ui/search-field';
import { Text } from '@/components/ui/text';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { pageOf, usePageNumber } from '@/lib/finance/paged';
import { forgetMerchantName, nameMerchant } from '@/lib/supabase/merchant-aliases';
import { tid, type TestId } from '@/lib/test-ids';
import { showToast } from '@/lib/toast/toast-store';
import { merchantKey, monthMerchants, isMonthKey, monthName } from '@repo/core';
import { deviceCalendar } from '@/lib/dates/device-calendar';

function failed(error: unknown) {
  showToast({ text: error instanceof Error ? error.message : "Couldn't save the name." });
}

/**
 * `/merchants` (Profile) and `/budget/merchants` (Budget's merchant count, under the Budget tab):
 * the codes to name, every merchant a month's spending went to (20 a page), then the names given.
 * `month` picks the month; without it the page shows this month.
 */
export default function MerchantsScreen() {
  const params = useLocalSearchParams<{ month?: string }>();
  const tokens = useThemeTokens();
  const data = useBudgetData();
  const { toName, named } = useMerchantNames();
  const [editing, setEditing] = useState<TestId | null>(null);
  const [risen, setRisen] = useState<string | null>(null);
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
    () => monthMerchants({
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
  const matches = (...texts: (string | null)[]) =>
    !words || texts.some((text) => text?.toLowerCase().includes(words));
  const spent = merchants.filter((merchant) => matches(merchant.name));
  const shownToName = toName.filter((row) => matches(row.name, row.raw));
  const shownNamed = named.filter((row) => matches(row.name, row.raw));
  const [page, setPage] = usePageNumber(JSON.stringify([month, words]));
  const current = pageOf(spent, page);
  const turnPage = (next: number) => {
    setPage(next);
    scroll.current?.scrollTo({ y: contentTop + listY.current, animated: !reduceMotion });
  };

  const save = async (row: MerchantRowData, name: string): Promise<Saved | void> => {
    if (name === row.name) return;
    const previous = row.name;
    await nameMerchant(row.key, name);
    setRisen(row.key);
    return {
      text: `${row.raw} is now ${name}`,
      undo: () => {
        setRisen(row.key);
        void (previous ? nameMerchant(row.key, previous) : forgetMerchantName(row.key)).catch(
          failed,
        );
      },
    };
  };

  const forget = async (row: MerchantRowData) => {
    setEditing(null);
    const previous = row.name;
    try {
      await forgetMerchantName(row.key);
    } catch (error) {
      failed(error);
      return;
    }
    setRisen(row.key);
    if (!previous) return;
    showToast({
      text: 'Name forgotten',
      undo: () => {
        setRisen(row.key);
        void nameMerchant(row.key, previous).catch(failed);
      },
    });
  };

  const rows = (list: MerchantRowData[], section: MerchantSection) =>
    list.map((row) => (
      <MerchantRow
        key={row.key}
        row={row}
        section={section}
        rises={risen === row.key}
        onSave={(name) => save(row, name)}
        onForget={() => void forget(row)}
      />
    ));

  const codeToName = (name: string) => {
    const key = merchantKey(name);
    return toName.find((row) => row.key === key) ?? null;
  };
  const nothingFound = words && !spent.length && !shownToName.length && !shownNamed.length;

  return (
    <Page
      headerScrolls
      screen="merchants"
      kind="pushed"
      title="Merchants"
    >
      <InPlaceGroup
        editing={editing}
        onEditingChange={(id) => {
          if (id) setRisen(null);
          setEditing(id);
        }}
      >
      <PageScroll
        ref={scroll}
        className="flex-1"
        contentContainerClassName="gap-5 px-5 pb-10"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <SearchField
          compact
          testID={tid('merchants', 'search')}
          accessibilityLabel="Search merchants"
          placeholder="Search a name or a bank code"
          value={query}
          onChangeText={setQuery}
        />

        {nothingFound ? (
          <EmptyTile
            mood="thinking"
            title={`No matches for "${query.trim()}"`}
            body="Try part of a name, or the code a bank alert shows."
            action={{
              testID: tid('merchants', 'clear-search'),
              label: 'Clear search',
              onPress: () => setQuery(''),
            }}
          />
        ) : null}

        {shownToName.length > 0 ? (
          <ListSection label={`${shownToName.length} to name`}>
            {rows(shownToName, 'to-name')}
          </ListSection>
        ) : words ? null : (
          <View className="flex-row items-center gap-3 rounded-tile border-[1.5px] border-dashed border-hairline px-[18px] py-3.5">
            <IconSymbol
              name="check-circle"
              size={22}
              color={tokens.deepMint}
            />
            <Text
              variant="body"
              className="min-w-0 flex-1 text-foreground"
            >
              Nothing to name. Moni lists a code here once it shows up 3 times.
            </Text>
          </View>
        )}

        {spent.length ? (
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
              {`${spent.length} spent in ${monthLabel}`}
            </Text>
            {/* Turning the page swaps every row at once, so the old rows leave without animating. */}
            <LayoutAnimationConfig
              key={current.page}
              skipExiting
            >
              <ListCard settles>
                {current.rows.map((merchant) => {
                  const code = codeToName(merchant.name);
                  return (
                    <ListItemMotion key={merchant.name}>
                      <MerchantSpendRow
                        screen="merchants"
                        merchant={merchant}
                        icon={merchant.icon}
                        color={merchant.color}
                        currency={currency}
                        walletNames={walletNames}
                        onOpen={() => openSpending({ kind: 'merchant', name: merchant.name }, month)}
                        codeKey={code?.key ?? null}
                        onName={code ? (_key, _raw, typed) => save(code, typed) : undefined}
                      />
                    </ListItemMotion>
                  );
                })}
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
        ) : null}

        {shownNamed.length > 0 ? (
          <ListSection label={`${shownNamed.length} named`}>
            {rows(shownNamed, 'named')}
          </ListSection>
        ) : null}

        <Text
          variant="meta"
          className="px-1 text-muted"
        >
          You can also name a code on a transaction.
        </Text>
      </PageScroll>
      </InPlaceGroup>
    </Page>
  );
}
