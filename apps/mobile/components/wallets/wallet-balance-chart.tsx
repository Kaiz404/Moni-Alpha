import { useMemo, useState } from 'react';
import { View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { PagerStep } from '@/components/activity/paged-transactions';
import { Segmented } from '@/components/ui/segmented';
import { Text } from '@/components/ui/text';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { balanceIndex, hasOlderWindow } from '@/lib/finance/balance-history';
import type { FinanceTransaction, FinanceWallet } from '@/lib/finance/types';
import { tid } from '@/lib/test-ids';

import { BalancePlot } from './balance-plot';
import { dayReading, netWorthTarget } from './net-worth-geometry';
import {
  addDays,
  CHART_RANGES,
  type ChartRange,
  formatMoney,
  formatSignedMoney,
  monthName,
  monthShort,
} from '@repo/core';
import { deviceCalendar } from '@/lib/dates/device-calendar';

const STEPS_IN = FadeIn.duration(180);
const STEPS_OUT = FadeOut.duration(180);
const LAST: Record<Exclude<ChartRange, '1m'>, string> = {
  '7d': 'Last 7 days',
  '30d': 'Last 30 days',
  '90d': 'Last 90 days',
  '1y': 'Last 12 months',
  all: 'All time',
};

/** What went in, out of, and between this wallet from `first` to `last`, local `YYYY-MM-DD` days. */
export function walletFlows(
  walletId: string,
  transactions: readonly FinanceTransaction[],
  first: string,
  last: string,
): { inMinor: number; outMinor: number; movedMinor: number } {
  let inMinor = 0;
  let outMinor = 0;
  let movedMinor = 0;
  for (const transaction of transactions) {
    if (transaction.balanceCorrection) continue;
    const day = deviceCalendar.dayKey(transaction.transactionDate);
    if (day < first || day > last) continue;
    const amount = Number(transaction.amountMinor);
    if (transaction.type === 'transfer') {
      if (transaction.walletId === walletId || transaction.transferToWalletId === walletId)
        movedMinor += amount;
    } else if (transaction.walletId === walletId) {
      if (transaction.type === 'income') inMinor += amount;
      else outMinor += amount;
    }
  }
  return { inMinor, outMinor, movedMinor };
}

/** "3 Nov", with the year when it is not this year's. */
function shortDate(date: Date, now: Date): string {
  const year = date.getFullYear() === now.getFullYear() ? '' : ` ${date.getFullYear()}`;
  return `${date.getDate()} ${monthShort(deviceCalendar.monthKey(date))}${year}`;
}

/** The window's name: its month on 1M, "Last 30 days" while it ends today, else its dates. */
function windowLabel(range: ChartRange, back: number, start: Date, end: Date, now: Date): string {
  if (range === '1m') {
    const year = start.getFullYear() === now.getFullYear() ? '' : ` ${start.getFullYear()}`;
    return `${monthName(deviceCalendar.monthKey(start))}${year}`;
  }
  if (back === 0) return LAST[range];
  return `${shortDate(start, now)} to ${shortDate(end, now)}`;
}

/**
 * The wallet page's chart: the wallet's closing balance over a range, on the same plot and chips
 * as net worth. Earlier and Later step the range back through time a window at a time (a calendar
 * month on 1M), and each step glides the axes on the shared zoom.
 */
export function WalletBalanceChart({
  wallet,
  balanceMinor,
  transactions,
  now,
}: {
  wallet: FinanceWallet;
  /** The live balance the history walks back from. */
  balanceMinor: number;
  transactions: readonly FinanceTransaction[];
  now: Date;
}) {
  const tokens = useThemeTokens();
  const [{ range, back }, setWindow] = useState<{ range: ChartRange; back: number }>({
    range: '1m',
    back: 0,
  });
  const index = useMemo(
    () =>
      balanceIndex({
        now,
        wallets: [{ id: wallet.id, balanceMinor, createdAt: wallet.createdAt }],
        transactions,
      }),
    [now, wallet.id, wallet.createdAt, balanceMinor, transactions],
  );
  const names = useMemo(() => ({ [wallet.id]: wallet.name }), [wallet.id, wallet.name]);
  const target = useMemo(
    () =>
      netWorthTarget({
        index,
        now,
        range,
        back,
        view: 'total',
        names,
        currency: wallet.currency,
        title: `${wallet.name} balance`,
      }),
    [index, now, range, back, names, wallet.currency, wallet.name],
  );
  const lines = useMemo(
    () => [
      {
        id: wallet.id,
        values: index.total,
        color: tokens.foreground,
        strokeWidth: 3,
        dash: undefined,
        area: tokens.sand,
        dotSize: 14,
      },
    ],
    [wallet.id, index, tokens],
  );

  const { from, to } = target;
  const start = deviceCalendar.startOfDay(addDays(index.firstDay, from));
  const end = deviceCalendar.startOfDay(addDays(index.firstDay, to));
  const label = windowLabel(range, back, start, end, now);
  const flows = walletFlows(wallet.id, transactions, deviceCalendar.dayKey(start), deviceCalendar.dayKey(end));
  // The balance before the window's first day, so the change counts that day as In and Out do.
  const opening = from > 0 ? index.total[from - 1]! : index.total[from]!;
  const change = index.total[to]! - opening;
  const since = shortDate(start, now);
  const amount = formatMoney(Math.abs(change), wallet.currency);
  const direction = change < 0 ? 'Down' : 'Up';
  const moved = change === 0 ? 'No change' : `${direction} ${amount}`;
  const title = back === 0 ? `${moved} since ${since}` : moved;
  const sub = [
    flows.inMinor ? `In ${formatSignedMoney('income', flows.inMinor, wallet.currency)}` : null,
    flows.outMinor ? `Out ${formatSignedMoney('expense', flows.outMinor, wallet.currency)}` : null,
    flows.movedMinor ? `Moved ${formatMoney(flows.movedMinor, wallet.currency)}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <View
      className="gap-2 rounded-card bg-card px-[18px] py-3.5"
      accessibilityLabel={`${wallet.name} balance, ${label}`}
    >
      <View className="h-11 flex-row items-center justify-between gap-3">
        <Text
          testID={tid('wallet', 'chart', 'window')}
          variant="caps"
          className="min-w-0 flex-1 text-muted"
          numberOfLines={1}
        >
          {label}
        </Text>
        {range === 'all' ? null : (
          <Animated.View
            entering={STEPS_IN}
            exiting={STEPS_OUT}
            className="flex-row gap-2"
          >
            <PagerStep
              testID={tid('wallet', 'chart', 'earlier')}
              icon="chevron-left"
              label="Earlier"
              enabled={hasOlderWindow(index, now, range, back)}
              onPress={() => setWindow({ range, back: back + 1 })}
            />
            <PagerStep
              testID={tid('wallet', 'chart', 'later')}
              icon="chevron-right"
              label="Later"
              enabled={back > 0}
              onPress={() => setWindow({ range, back: back - 1 })}
            />
          </Animated.View>
        )}
      </View>
      <View>
        <Text
          variant="cardTitle"
          className="text-foreground"
          style={{ fontVariant: ['tabular-nums'] }}
        >
          {title}
        </Text>
        <Text
          variant="meta"
          className="text-ink-2"
          numberOfLines={1}
        >
          {sub || ' '}
        </Text>
      </View>
      <BalancePlot
        index={index}
        target={target}
        lines={lines}
        linesKey="balance"
        pickKey={`${range}:${back}`}
        currency={wallet.currency}
        now={now}
        reading={(day) => dayReading(index, day, 'total', names, wallet.currency, now)}
      />
      <Segmented
        screen="wallet"
        name="chart"
        size="compact"
        options={CHART_RANGES}
        value={range}
        accessibilityLabel="Time range"
        onChange={(next) => setWindow({ range: next, back: 0 })}
      />
    </View>
  );
}
