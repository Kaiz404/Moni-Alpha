import { useMemo } from 'react';
import { View } from 'react-native';

import { DayGroup } from '@/components/activity/day-group';
import type { HoldAnchor } from '@/components/ui/hold-menu';
import { IconSymbol, type IconSymbolName } from '@/components/ui/icon-symbol';
import { Press } from '@/components/ui/press';
import { Text } from '@/components/ui/text';
import { TransactionRow } from '@/components/ui/transaction-row';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { formatDayHeading } from '@/lib/dates/day-label';
import { groupActivityDays, type ActivityDay } from '@/lib/finance/activity-filter';
import { formatMoney } from '@/lib/finance/format-money';
import { pageOf, type Page } from '@/lib/finance/paged';
import type { FinanceTransaction } from '@/lib/finance/types';
import { tid, type Screen, type TestId } from '@/lib/test-ids';
import { transactionRow, type RowLookups, type TransactionRowData } from '@/lib/transactions/row';

function dayTotal(day: ActivityDay, currency: string) {
  return [
    day.spentMinor > 0 ? `−${formatMoney(day.spentMinor, currency)}` : null,
    day.inMinor > 0 ? `+${formatMoney(day.inMinor, currency)}` : null,
  ]
    .filter(Boolean)
    .join(' · ');
}

function PagerStep({
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

/** Newer and older around where this page sits. Nothing shows while everything fits on one page. */
export function Pager<T>({
  screen,
  page,
  onPage,
}: {
  screen: Screen;
  page: Page<T>;
  onPage: (page: number) => void;
}) {
  if (page.pageCount < 2) return null;
  return (
    <View className="flex-row items-center justify-between gap-3 pt-1">
      <PagerStep
        testID={tid(screen, 'pager', 'newer')}
        icon="chevron-left"
        label="Newer transactions"
        enabled={page.page > 1}
        onPress={() => onPage(page.page - 1)}
      />
      <View
        accessible
        accessibilityLabel={`Page ${page.page} of ${page.pageCount}, transactions ${page.first} to ${page.last} of ${page.total}`}
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
        testID={tid(screen, 'pager', 'older')}
        icon="chevron-right"
        label="Older transactions"
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
    for (const day of groupActivityDays(transactions)) byDay.set(day.key, dayTotal(day, currency));
    return byDay;
  }, [transactions, currency]);
  const days = useMemo(() => groupActivityDays(current.rows), [current.rows]);
  return (
    <View className="gap-3.5">
      {days.map((group) => (
        <DayGroup
          key={group.key}
          label={formatDayHeading(group.transactions[0].transactionDate, now)}
          total={totals.get(group.key) ?? ''}
        >
          {group.transactions.map((transaction) => {
            const row = transactionRow(transaction, lookups);
            return (
              <TransactionRow
                key={transaction.id}
                testID={tid(screen, 'transaction', transaction.id)}
                row={row}
                metaLead="category"
                now={now}
                onPress={() => onOpen(transaction)}
                onHold={holdFor?.(transaction, row)}
              />
            );
          })}
        </DayGroup>
      ))}
      <Pager
        screen={screen}
        page={current}
        onPage={onPage}
      />
    </View>
  );
}
