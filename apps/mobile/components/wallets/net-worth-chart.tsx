import { useMemo, useState } from 'react';
import { View } from 'react-native';
import Animated, { LinearTransition } from 'react-native-reanimated';

import { Segmented } from '@/components/ui/segmented';
import { Text } from '@/components/ui/text';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { springs } from '@repo/design';
import { tid } from '@/lib/test-ids';
import { compactWalletNames } from '@repo/core';

import { BalancePlot, type BalanceLineSpec } from './balance-plot';
import {
  dayReading,
  netWorthTarget,
  walletLineStyles,
  type NetWorthView,
} from './net-worth-geometry';
import {
  balanceIndex,
  type FinanceTransaction,
  type FinanceWallet,
  CHART_RANGES,
  type ChartRange,
  formatMoney,
} from '@repo/core';
import { deviceCalendar } from '@/lib/dates/device-calendar';

/** The wallet tints are pale on Paper, so their lines run thicker than the Ink total. */
const WALLET_LINE_WIDTH = 3.5;
const VIEWS: readonly { value: NetWorthView; label: string }[] = [
  { value: 'total', label: 'Total' },
  { value: 'by-wallet', label: 'By wallet' },
];

/** The card and everything under it slide together when the key opens below the chart. */
export const netWorthLayout = LinearTransition.springify()
  .stiffness(springs.sheet.stiffness)
  .damping(springs.sheet.damping);

/**
 * The Wallets card: net worth now, its closing balance over a chosen range, as one line or one per
 * wallet. The balances are indexed once; a range change zooms the axes on one spring. The number
 * stays on the live balance, and the callout and key read the scrubbed day.
 */
export function NetWorthChart({
  now,
  currency,
  totalMinor,
  wallets,
  balances,
  transactions,
}: {
  now: Date;
  currency: string;
  totalMinor: number;
  /** Main-currency wallets, in list order. */
  wallets: readonly FinanceWallet[];
  balances: Readonly<Record<string, number>>;
  transactions: readonly FinanceTransaction[];
}) {
  const tokens = useThemeTokens();
  const [range, setRange] = useState<ChartRange>('30d');
  const [chosenView, setView] = useState<NetWorthView>('total');
  const view = wallets.length > 1 ? chosenView : 'total';

  const index = useMemo(
    () =>
      balanceIndex({
        now,
        calendar: deviceCalendar,
        wallets: wallets.map((wallet) => ({
          id: wallet.id,
          balanceMinor: Number(balances[wallet.id] ?? 0),
          createdAt: wallet.createdAt,
        })),
        transactions,
      }),
    [now, wallets, balances, transactions],
  );
  const names = useMemo(() => compactWalletNames(wallets), [wallets]);
  const target = useMemo(
    () => netWorthTarget({ index, now, range, view, names, currency }),
    [index, now, range, view, names, currency],
  );
  const lines = useMemo<BalanceLineSpec[]>(() => {
    if (view === 'total')
      return [
        {
          id: 'total',
          values: index.total,
          color: tokens.foreground,
          strokeWidth: 3,
          dash: undefined,
          area: tokens.sand,
          dotSize: 14,
        },
      ];
    const styles = walletLineStyles(wallets, tokens);
    return Object.keys(names).map((id) => ({
      id,
      values: index.byWallet[id]!,
      color: styles[id]!.color,
      strokeWidth: WALLET_LINE_WIDTH,
      dash: styles[id]!.dash,
      area: null,
      dotSize: 11,
    }));
  }, [view, index, names, wallets, tokens]);
  const hasWallets = wallets.length > 0;

  return (
    <Animated.View
      layout={netWorthLayout}
      className="gap-2 rounded-card bg-card px-[18px] py-3.5"
    >
      <View className="min-h-9 flex-row items-center justify-between">
        <Text
          variant="caps"
          className="text-muted"
        >
          Net worth
        </Text>
        {wallets.length > 1 ? (
          <Segmented
            screen="wallet"
            name="chart"
            size="compact"
            segmentWidth={70}
            accessibilityLabel="Net worth chart"
            options={VIEWS}
            value={view}
            onChange={setView}
          />
        ) : null}
      </View>
      <Text
        testID={tid('wallet', 'list', 'net-worth')}
        className="text-[32px] leading-9 font-display-bold text-foreground"
        style={{ fontVariant: ['tabular-nums'] }}
      >
        {formatMoney(totalMinor, currency)}
      </Text>
      {hasWallets ? (
        <>
          <BalancePlot
            index={index}
            target={target}
            lines={lines}
            linesKey={view}
            pickKey={range}
            currency={currency}
            now={now}
            reading={(day) => dayReading(index, day, view, names, currency, now)}
          />
          <Segmented
            screen="wallet"
            name="chart"
            size="compact"
            options={CHART_RANGES}
            value={range}
            accessibilityLabel="Time range"
            onChange={setRange}
          />
        </>
      ) : null}
    </Animated.View>
  );
}
