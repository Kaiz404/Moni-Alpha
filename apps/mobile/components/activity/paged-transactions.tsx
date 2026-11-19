import { useMemo } from 'react';
import { View } from 'react-native';
import Animated, { LayoutAnimationConfig } from 'react-native-reanimated';

import { DayGroup } from '@/components/activity/day-group';
import { ListItemMotion, listSettle } from '@/components/ui/list-motion';
import type { HoldAnchor } from '@/components/ui/hold-menu';
import { IconSymbol, type IconSymbolName } from '@/components/ui/icon-symbol';
import { Press } from '@/components/ui/press';
import { Text } from '@/components/ui/text';
import { TransactionRow } from '@/components/ui/transaction-row';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { pageOf, type Page } from '@/lib/finance/paged';
import { tid, type Screen, type TestId } from '@/lib/test-ids';
import { type TransactionRowData } from '@/lib/transactions/row';
import { transactionRow, type RowLookups } from '@repo/core';
import {
  groupActivityDays,
  type ActivityDay,
  type FinanceTransaction,
  dayHeading,
  formatSignedMoney,
} from '@repo/core';
import { deviceCalendar } from '@/lib/dates/device-calendar';

function dayTotal(day: ActivityDay, currency: string) {
  return [
    day.spentMinor > 0 ? formatSignedMoney('expense', day.spentMinor, currency) : null,
    day.inMinor > 0 ? formatSignedMoney('income', day.inMinor, currency) : null,
  ]
    .filter(Boolean)
    .join(' · ');
}

export function PagerStep({
  testID,
  icon,
  label,
  enabled,
  onPress,
}: {
  testID: TestId;
  icon: IconSymbolName;
  label: string;
  enabled: boolean;
  onPress: () => void;
}) {
  const tokens = useThemeTokens();
  return (
    <Press
      testID={testID}
      accessibilityLabel={label}
      accessibilityState={{ disabled: !enabled }}
      disabled={!enabled}
      onPress={onPress}
      radius={{ rest: 22, pressed: 16 }}
      pressedClassName="bg-hairline"
      className="h-11 w-11 items-center justify-center bg-sand"
    >
      <IconSymbol
        name={icon}
        size={22}
        color={enabled ? tokens.foreground : tokens.inactive}
      />
    </Press>
  );
}

/** What a pager's steps and position call the rows: newest-first transactions, or a ranked list. */
const PAGER_WORDS = {
  transactions: {
    back: ['newer', 'Newer transactions'],
    forward: ['older', 'Older transactions'],
    rows: 'transactions',
  },
  merchants: { back: ['previous', 'Previous page'], forward: ['next', 'Next page'], rows: 'merchants' },
} as const;

/** Back and forward around where this page sits. Nothing shows while everything fits on one page. */
export function Pager<T>({
  screen,
  page,
  onPage,
  of = 'transactions',
}: {
  screen: Screen;
  page: Page<T>;
  onPage: (page: number) => void;
  of?: keyof typeof PAGER_WORDS;
}) {
  const words = PAGER_WORDS[of];
  if (page.pageCount < 2) return null;
  return (
    <View className="flex-row items-center justify-between gap-3 pt-1">
      <PagerStep
        testID={tid(screen, 'pager', words.back[0])}
        icon="chevron-left"
        label={words.back[1]}
        enabled={page.page > 1}
        onPress={() => onPage(page.page - 1)}
      />
      <View
        accessible
        accessibilityLabel={`Page ${page.page} of ${page.pageCount}, ${words.rows} ${page.first} to ${page.last} of ${page.total}`}
        className="min-w-0 flex-1 items-center"
      >
        <Text
          testID={tid(screen, 'pager', 'page')}
          className="text-[15px] leading-[21px] font-display-semibold text-foreground"
          style={{ fontVariant: ['tabular-nums'] }}
        >
          {`Page ${page.page} of ${page.pageCount}`}
        </Text>
        <Text
          variant="meta"
          className="text-muted"
          style={{ fontVariant: ['tabular-nums'] }}
        >
          {`${page.first} to ${page.last} of ${page.total}`}
        </Text>
      </View>
      <PagerStep
        testID={tid(screen, 'pager', words.forward[0])}
        icon="chevron-right"
        label={words.forward[1]}
        enabled={page.page < page.pageCount}
        onPress={() => onPage(page.page + 1)}
      />
    </View>
  );
}

/**
 * One page of newest-first transactions under their day headings, then the pager. A day's total
 * counts the whole day, even when the day runs across two pages. The parent owns the page number
 * (`usePageNumber`) so it can scroll back up to the list when the page changes.
 */
export function PagedTransactions({
  screen,
  transactions,
  lookups,
  currency,
  now,
  page,
  onPage,
  onOpen,
  holdFor,
}: {
  screen: Screen;
  transactions: readonly FinanceTransaction[];
  lookups: RowLookups;
  currency: string;
  now: Date;
  page: number;
  onPage: (page: number) => void;
  onOpen: (transaction: FinanceTransaction) => void;
  holdFor?: (
    transaction: FinanceTransaction,
    row: TransactionRowData,
  ) => ((anchor: HoldAnchor) => void) | undefined;
}) {
  const current = useMemo(() => pageOf(transactions, page), [transactions, page]);
  const totals = useMemo(() => {
    const byDay = new Map<string, string>();
    for (const day of groupActivityDays(transactions, deviceCalendar)) byDay.set(day.key, dayTotal(day, currency));
    return byDay;
  }, [transactions, currency]);
  const days = useMemo(() => groupActivityDays(current.rows, deviceCalendar), [current.rows]);
  return (
    <View className="gap-3.5">
      {/* Turning the page swaps every row at once, so the old rows leave without animating. */}
      <LayoutAnimationConfig
        key={current.page}
        skipExiting
      >
        {days.map((group) => (
          <ListItemMotion key={group.key}>
            <DayGroup
              label={dayHeading(deviceCalendar.dayKey(group.transactions[0].transactionDate), deviceCalendar.dayKey(now))}
              total={totals.get(group.key) ?? ''}
            >
              {group.transactions.map((transaction) => {
                const row = transactionRow(transaction, lookups);
                return (
                  <ListItemMotion key={transaction.id}>
                    <TransactionRow
                      testID={tid(screen, 'transaction', transaction.id)}
                      row={row}
                      metaLead="category"
                      now={now}
                      onPress={() => onOpen(transaction)}
                      onHold={holdFor?.(transaction, row)}
                    />
                  </ListItemMotion>
                );
              })}
            </DayGroup>
          </ListItemMotion>
        ))}
        <Animated.View layout={listSettle}>
          <Pager
            screen={screen}
            page={current}
            onPage={onPage}
          />
        </Animated.View>
      </LayoutAnimationConfig>
    </View>
  );
}
