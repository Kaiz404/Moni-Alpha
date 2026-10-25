import type { MerchantAlias, UpcomingBill } from '@repo/types';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { CalendarHeat } from '@/components/budget/calendar-heat';
import { MerchantList } from '@/components/budget/merchant-list';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { ListCard } from '@/components/ui/list-card';
import { Press } from '@/components/ui/press';
import { Text } from '@/components/ui/text';
import { TransactionRow } from '@/components/ui/transaction-row';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { calendarHeat } from '@/lib/finance/calendar-heat';
import {
  dayOfMonth,
  monthName,
  monthShort,
  monthSpend,
  topMerchants,
  type BudgetMonth,
} from '@/lib/finance/budget-month';
import { formatMoney } from '@/lib/finance/format-money';
import { merchantName } from '@/lib/finance/merchant-name';
import type {
  FinanceCategory,
  FinanceTransaction,
} from '@/lib/finance/types';
import { tid } from '@/lib/test-ids';
import { transactionRow } from '@/lib/transactions/row';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
/** The day panel shows this many rows, then links to the rest in Activity. */
const DAY_ROWS = 3;

type CalendarViewProps = {
  month: BudgetMonth;
  transactions: readonly FinanceTransaction[];
  categoriesById: Record<string, FinanceCategory>;
  walletNames: Record<string, string>;
  bills: readonly UpcomingBill[];
  aliases: readonly Pick<MerchantAlias, 'rawKey' | 'displayName'>[];
  now: Date;
};

/** The Calendar side of the Budget tab: heat by day, the picked day's rows, top merchants. */
export function CalendarView({
  month,
  transactions,
  categoriesById,
  walletNames,
  bills,
  aliases,
  now,
}: CalendarViewProps) {
  const tokens = useThemeTokens();
  const { currency, evenPaceMinor } = month;
  const today = month.isCurrent ? now.getDate() : null;
  const [picked, setPicked] = useState<{
    month: string;
    day: number;
  } | null>(null);
  const selected =
    picked?.month === month.month ? picked.day : month.throughDay;
  const spend = useMemo(
    () =>
      monthSpend(transactions, month.month, currency).map((transaction) =>
        transaction.merchant
          ? { ...transaction, merchant: merchantName(transaction.merchant, aliases) }
          : transaction,
      ),
    [transactions, aliases, month.month, currency],
  );
  const billByDay = useMemo(() => {
    const byDay: Record<number, UpcomingBill> = {};
    for (const bill of month.isCurrent ? bills : []) {
      if (
        bill.status !== 'due' ||
        !bill.dueDate.startsWith(month.month)
      )
        continue;
      byDay[Number(bill.dueDate.slice(8))] ??= bill;
    }
    return byDay;
  }, [bills, month.isCurrent, month.month]);
  const days = useMemo(
    () =>
      calendarHeat(
        month.daily.map((spentMinor, index) => ({
          day: index + 1,
          spentMinor:
            index + 1 <= month.throughDay ? spentMinor : null,
          billDue: Boolean(billByDay[index + 1]),
        })),
        evenPaceMinor,
      ),
    [month.daily, month.throughDay, billByDay, evenPaceMinor],
  );
  const short = monthShort(month.month);
  const [year, number] = month.month.split('-').map(Number);
  const weekday =
    WEEKDAYS[new Date(year, number - 1, selected).getDay()];
  const title = `${selected === today ? 'Today, ' : ''}${weekday} ${selected} ${short}`;
  const rows = spend.filter(
    (transaction) => dayOfMonth(transaction) === selected,
  );
  const daySpent = Number(month.daily[selected - 1] ?? 0);
  const whole = (value: number) =>
    formatMoney(value, currency, { whole: true });
  const atOrUnder = days.filter(
    (day) =>
      day.spentMinor !== null &&
      (day.bucket === 'under' || day.bucket === 'plain'),
  ).length;
  const counted = days.filter(
    (day) => day.spentMinor !== null,
  ).length;
  const bill = billByDay[selected];
  const paceNote =
    evenPaceMinor === null
      ? null
      : daySpent <= evenPaceMinor
        ? `${formatMoney(evenPaceMinor - daySpent, currency)} under even pace`
        : `${formatMoney(daySpent - evenPaceMinor, currency)} over even pace`;
  const { merchants } = useMemo(
    () => topMerchants(spend, 4),
    [spend],
  );
  const lookup = { categoriesById, walletNames };
  const lastCategory = (name: string) => {
    const transaction = spend.find(
      (item) => (item.merchant ?? item.description) === name,
    );
    const category = transaction?.categoryId
      ? categoriesById[transaction.categoryId]
      : undefined;
    return {
      icon: category?.icon ?? null,
      color: category?.color ?? null,
    };
  };

  return (
    <View className="gap-3">
      {evenPaceMinor !== null && month.spentMinor > 0 ? (
        <Text
          variant="meta"
          className="text-ink-2"
          style={{ fontVariant: ['tabular-nums'] }}
        >
          {`${atOrUnder} of ${counted} days at or under even pace, ${whole(evenPaceMinor)} a day`}
        </Text>
      ) : null}
      <CalendarHeat
        month={month.month}
        monthName={monthName(month.month)}
        days={days}
        today={today}
        selected={selected}
        currency={currency}
        billNames={Object.fromEntries(
          Object.entries(billByDay).map(([day, due]) => [
            day,
            `${due.name} ${formatMoney(due.amountMinor, due.currency)}`,
          ]),
        )}
        onSelect={(day) => setPicked({ month: month.month, day })}
      />
      <View
        className="gap-2"
        accessibilityLiveRegion="polite"
      >
        <View className="flex-row items-baseline justify-between">
          <Text
            variant="sectionTitle"
            className="text-foreground"
            accessibilityRole="header"
          >
            {title}
          </Text>
          <Text
            variant="sectionTitle"
            className="text-foreground"
            style={{ fontVariant: ['tabular-nums'] }}
          >
            {formatMoney(daySpent, currency)}
          </Text>
        </View>
        {rows.length ? (
          <>
            <Text
              variant="meta"
              className="-mt-1 text-ink-2"
            >
              {[
                rows.length === 1
                  ? '1 payment'
                  : `${rows.length} payments`,
                paceNote,
              ]
                .filter(Boolean)
                .join(' · ')}
            </Text>
            <ListCard>
              {rows.slice(0, DAY_ROWS).map((transaction) => (
                <TransactionRow
                  key={transaction.id}
                  testID={tid('budget', 'day', 'row', transaction.id)}
                  row={transactionRow(transaction, lookup)}
                  metaLead="category"
                  onPress={() =>
                    router.push({
                      pathname: '/transaction/[id]',
                      params: { id: transaction.id },
                    })
                  }
                />
              ))}
              {rows.length > DAY_ROWS ? (
                <Press
                  testID={tid('budget', 'day', 'all')}
                  accessibilityLabel={`All ${rows.length} on ${weekday} ${selected} ${short}. Open in Activity`}
                  onPress={() =>
                    router.navigate({
                      pathname: '/activity',
                      params: { day: `${month.month}-${String(selected).padStart(2, '0')}` },
                    })
                  }
                  className="min-h-11 flex-row items-center gap-0.5 pl-[18px] pr-3"
                >
                  <Text className="text-[15px] leading-5 font-display-semibold text-deep-mint">
                    {`All ${rows.length} on ${weekday} ${selected} ${short}`}
                  </Text>
                  <IconSymbol
                    name="chevron-right"
                    size={20}
                    color={tokens.deepMint}
                  />
                </Press>
              ) : null}
            </ListCard>
          </>
        ) : (
          <View className="gap-1 rounded-tile border-[1.5px] border-dashed border-hairline px-[18px] py-4">
            <Text
              variant="rowTitle"
              className="text-foreground"
            >
              {bill
                ? `${bill.name} ${formatMoney(bill.amountMinor, bill.currency)} is due`
                : today !== null && selected > today
                  ? 'Nothing spent yet'
                  : 'Nothing spent'}
            </Text>
            {bill && month.left ? (
              <Text
                variant="meta"
                className="text-ink-2"
              >
                {`Budget has set this aside, so it is already out of your ${whole(Math.max(0, month.left.leftMinor))} left.`}
              </Text>
            ) : evenPaceMinor !== null &&
              today !== null &&
              selected >= today ? (
              <Text
                variant="meta"
                className="text-ink-2"
              >
                {`Days fill in as you spend. Even pace stays ${whole(evenPaceMinor)} a day.`}
              </Text>
            ) : null}
          </View>
        )}
      </View>
      <View className="pt-2">
        <MerchantList
          merchants={merchants}
          currency={currency}
          walletNames={walletNames}
          look={(merchant) => lastCategory(merchant.name)}
          onSeeAll={() => router.navigate('/activity')}
        />
      </View>
    </View>
  );
}
