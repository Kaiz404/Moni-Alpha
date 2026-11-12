import { MONTHS, niceCeil } from '@/components/charts/pace-geometry';
import type { BubbleTint } from '@/components/ui/nav-row';
import { walletBubbleTint } from '@/constants/wallet-card-styles';
import { dayLabel } from '@/lib/dates/day-label';
import { toLocalDateInput } from '@/lib/dates/local-date-input';
import { balanceViewport, type BalanceIndex } from '@/lib/finance/balance-history';
import { dateAt, type ChartRange } from '@/lib/finance/chart-range';
import { chartTicks } from '@/lib/finance/chart-ticks';
import { formatMoney } from '@/lib/finance/format-money';
import { scrubPoints, type ScrubPoints } from '@/components/charts/scrub';
import type { AxisRow, TickMark } from '@/components/charts/zoom-axes';

export type NetWorthView = 'total' | 'by-wallet';

export type WalletLineStyle = { color: string; dash: string | undefined };

/**
 * What one range and view shows, in data space: days from the index's first day across (today at
 * `to`), minor units up.
 */
export type NetWorthTarget = {
  from: number;
  to: number;
  low: number;
  high: number;
  axis: AxisRow[];
  ticks: TickMark[];
  /** Where a scrub lands; each reads a day. */
  points: ScrubPoints;
  accessibilityLabel: string;
};

export const NET_WORTH_TOP = 44;
export const NET_WORTH_BASE = 142;
const LONG_RANGE_DAYS = 180;
/** Wallets that share a colour stay apart by pattern, in list order. */
const DASHES = [undefined, '7 5', '1 6', '12 5 1 5'];

/**
 * Each wallet's line in the tint of its bubble on the Wallets list, so a line reads as its wallet
 * without a key. `tints` is the theme's, so dark mode takes the dark list's tints.
 */
export function walletLineStyles(
  wallets: readonly { id: string; cardStyleId: string | null; type: string }[],
  tints: Readonly<Record<BubbleTint, string>>,
): Record<string, WalletLineStyle> {
  const seen = new Map<BubbleTint, number>();
  return Object.fromEntries(
    wallets.map((wallet) => {
      const tint = walletBubbleTint(wallet.cardStyleId, wallet.type);
      const count = seen.get(tint) ?? 0;
      seen.set(tint, count + 1);
      return [
        wallet.id,
        { color: tints[tint], dash: DASHES[count % DASHES.length] },
      ];
    }),
  );
}

function spanDate(date: Date, long: boolean): string {
  const month = MONTHS[date.getMonth()];
  return long ? `${month} ${date.getFullYear()}` : `${date.getDate()} ${month}`;
}

/** Each day in the range on which a transaction moved a balance, and today. */
export function netWorthScrubPoints(index: BalanceIndex, from: number, to: number): ScrubPoints {
  const pairs: [number, number][] = [];
  for (let day = from; day <= to; day++) if (day === to || index.changed[day]) pairs.push([day, day]);
  return scrubPoints(pairs);
}

/**
 * One range and view of the net worth chart. The first day sits on the left edge and today on
 * the right for every range, and the axis snaps to a nice unit around the lowest and highest
 * balance shown.
 */
export function netWorthTarget({
  index,
  now,
  range,
  view,
  names,
  currency,
}: {
  index: BalanceIndex;
  now: Date;
  range: ChartRange;
  view: NetWorthView;
  /** Wallet id to the name the key shows, in key order. */
  names: Record<string, string>;
  currency: string;
}): NetWorthTarget {
  const { from, to } = balanceViewport(index, now, range);
  const ids = Object.keys(names);
  const series =
    view === 'total' ? [index.total] : ids.map((id) => index.byWallet[id]).filter((values) => values !== undefined);
  let low = Infinity;
  let high = -Infinity;
  for (const values of series)
    for (let day = from; day <= to; day++) {
      const value = values[day]!;
      if (value !== value) continue;
      low = Math.min(low, value);
      high = Math.max(high, value);
    }
  if (low > high) [low, high] = [0, 0];
  const unit = niceCeil(Math.max(100, (high - low) / 2));
  const floor = Math.floor(low / unit) * unit;
  const ceiling = Math.max(floor + unit * 2, Math.ceil(high / unit) * unit);
  const axisMoney = (minor: number) => formatMoney(minor, currency, { whole: true });

  const money = (minor: number) => formatMoney(minor, currency);
  const count = to - from + 1;
  const span = count > 1 ? `${spanDate(dateAt(index.firstDay, from), to - from > LONG_RANGE_DAYS)} to today` : 'today';
  const reading =
    view === 'total'
      ? `Net worth, ${span}${count > 1 ? `, from ${money(index.total[from]!)} to ${money(index.total[to]!)}` : `, ${money(index.total[to]!)}`}.`
      : `Net worth by wallet, ${span}. ${ids
          .map((id) => `${names[id]} ${money(index.byWallet[id]?.[to] ?? 0)}`)
          .join(', ')}.`;

  return {
    from,
    to,
    low: floor,
    high: ceiling,
    axis: [
      { value: ceiling, text: axisMoney(ceiling), line: 'solid' },
      { value: (ceiling + floor) / 2, text: axisMoney((ceiling + floor) / 2), line: 'dashed' },
      { value: floor, text: axisMoney(floor), line: 'solid' },
    ],
    ticks: chartTicks({ range, firstDay: index.firstDay, first: from, last: to }).map((tick) => ({
      u: tick.day,
      label: tick.label,
    })),
    points: netWorthScrubPoints(index, from, to),
    accessibilityLabel:
      floor === 0 ? reading : `${reading} The axis starts at ${axisMoney(floor)}, not zero.`,
  };
}

/** The screen reader's value for a day: its date, then what each line reads there. */
export function dayReading(
  index: BalanceIndex,
  day: number,
  view: NetWorthView,
  names: Record<string, string>,
  currency: string,
  now: Date,
): string {
  const date = dayLabel(toLocalDateInput(dateAt(index.firstDay, day)), now);
  if (view === 'total') return `${date}, ${formatMoney(index.total[day]!, currency)}`;
  const parts = Object.entries(names).map(([id, name]) => {
    const value = index.byWallet[id]?.[day] ?? NaN;
    return value !== value ? `${name} not yet` : `${name} ${formatMoney(value, currency)}`;
  });
  return `${date}, ${parts.join(', ')}`;
}
