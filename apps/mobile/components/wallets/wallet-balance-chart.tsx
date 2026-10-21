import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { BalancePlot, Legend } from '@/components/charts/activity-chart';
import { Text } from '@/components/ui/text';
import { balanceMonth } from '@/lib/finance/activity-series';
import { monthKey, monthName } from '@/lib/finance/budget-month';
import { formatMoney, formatSignedMoney } from '@/lib/finance/format-money';
import type { FinanceTransaction, FinanceWallet } from '@/lib/finance/types';

/** This month's money in, out, and moved for one wallet; balance corrections are none of them. */
export function walletMonthFlows(
  wallet: Pick<FinanceWallet, 'id'>,
  transactions: readonly FinanceTransaction[],
  now: Date,
): { inMinor: number; outMinor: number; movedMinor: number } {
  const month = monthKey(now);
  let inMinor = 0;
  let outMinor = 0;
  let movedMinor = 0;
  for (const transaction of transactions) {
    if (transaction.balanceCorrection) continue;
    if (monthKey(new Date(transaction.transactionDate)) !== month) continue;
    const amount = Number(transaction.amountMinor);
    if (transaction.type === 'transfer') {
      if (transaction.walletId === wallet.id || transaction.transferToWalletId === wallet.id)
        movedMinor += amount;
    } else if (transaction.walletId === wallet.id) {
      if (transaction.type === 'income') inMinor += amount;
      else outMinor += amount;
    }
  }
  return { inMinor, outMinor, movedMinor };
}

/** V2H-WalletDetail's month card: the change since the 1st, in / out / moved, and the balance line. */
export function WalletBalanceChart({
  wallet,
  transactions,
  now,
}: {
  wallet: FinanceWallet;
  transactions: readonly FinanceTransaction[];
  /** Stable between renders (`useNow`), so the series is not rebuilt on every render. */
  now: Date;
}) {
  const [width, setWidth] = useState(314);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const balance = useMemo(
    () => balanceMonth([wallet], transactions, wallet.currency, now),
    [wallet, transactions, now],
  );
  const flows = useMemo(
    () => walletMonthFlows(wallet, transactions, now),
    [wallet, transactions, now],
  );
  const month = monthName(monthKey(now));
  const first = balance.days[0]?.balanceMinor ?? 0;
  const latest = balance.days.at(-1)?.balanceMinor ?? 0;
  const change = latest - first;
  const since = `1 ${month.slice(0, 3)}`;
  const title =
    change === 0
      ? `Same as on ${since}`
      : `${change < 0 ? 'Down' : 'Up'} ${formatMoney(Math.abs(change), wallet.currency)} since ${since}`;
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
      accessibilityLabel={`${wallet.name} balance in ${month}`}
    >
      <Text
        variant="caps"
        className="text-muted"
      >
        {month}
      </Text>
      <View>
        <Text
          variant="cardTitle"
          className="text-foreground"
          style={{ fontVariant: ['tabular-nums'] }}
        >
          {title}
        </Text>
        {sub ? (
          <Text
            variant="meta"
            className="text-ink-2"
            numberOfLines={1}
          >
            {sub}
          </Text>
        ) : null}
      </View>
      <View
        className="overflow-hidden"
        onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      >
        <BalancePlot
          balance={balance}
          currency={wallet.currency}
          selectedDay={selectedDay}
          onSelectDay={setSelectedDay}
          width={width}
          month={month}
          now={now}
          screen="wallet"
        />
      </View>
      <Legend
        spend={false}
        paced={false}
      />
    </View>
  );
}
