import { niceCeil } from '@/components/charts/pace-geometry';
import type { BubbleTint } from '@/components/ui/nav-row';
import { walletBubbleTint } from '@/constants/wallet-card-styles';
import { scrubPoints, type ScrubPoints } from '@/components/charts/scrub';
import type { AxisRow, TickMark } from '@/components/charts/zoom-axes';
import {
  balanceViewport,
  type BalanceIndex,
  addDays,
  type ChartRange,
  chartTicks,
  type DayKey,
  dayLabel,
  formatMoney,
  monthOf,
  monthShort,
  shortDate,
} from '@repo/core';
import { deviceCalendar } from '@/lib/dates/device-calendar';

export type NetWorthView = 'total' | 'by-wallet';

export type WalletLineStyle = { color: string; dash: number[] | undefined };

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
const DASHES = [undefined, [7, 5], [1, 6], [12, 5, 1, 5]];

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

function spanDate(day: DayKey, long: boolean): string {
  return long ? `${monthShort(monthOf(day))} ${day.slice(0, 4)}` : shortDate(day);
}

/** Every day in the range; days on which a transaction moved a balance tick. */
export function netWorthScrubPoints(index: BalanceIndex, from: number, to: number): ScrubPoints {
  const points: [number, number, boolean][] = [];
  for (let day = from; day <= to; day++) points.push([day, day, index.changed[day] === 1]);
  return scrubPoints(points);
}

/**
 * One range and view of the net worth chart, or of one wallet's balance. The first day sits on the
 * left edge and the window's last day (today unless `back` steps older) on the right, and the
 * axis snaps to a nice unit around the lowest and highest balance shown.
 */
export function netWorthTarget({
  index,
  now,
  range,
  back = 0,
  view,
  names,
  currency,
  title = 'Net worth',
}: {
  index: BalanceIndex;
  now: Date;
  range: ChartRange;
  /** Windows older than the one ending today. */
  back?: number;
  view: NetWorthView;
  /** Wallet id to the name the key shows, in key order. */
  names: Record<string, string>;
  currency: string;
  /** What the screen reader calls the total line. */
  title?: string;
}): NetWorthTarget {
  const { from, to } = balanceViewport(index, now, range, deviceCalendar, back);
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
  const long = to - from > LONG_RANGE_DAYS;
  const end = back > 0 ? spanDate(addDays(index.firstDay, to), long) : 'today';
  const span = count > 1 ? `${spanDate(addDays(index.firstDay, from), long)} to ${end}` : end;
  const reading =
    view === 'total'
      ? `${title}, ${span}${count > 1 ? `, from ${money(index.total[from]!)} to ${money(index.total[to]!)}` : `, ${money(index.total[to]!)}`}.`
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
  const date = dayLabel(addDays(index.firstDay, day), deviceCalendar.dayKey(now));
  if (view === 'total') return `${date}, ${formatMoney(index.total[day]!, currency)}`;
  const parts = Object.entries(names).map(([id, name]) => {
    const value = index.byWallet[id]?.[day] ?? NaN;
    return value !== value ? `${name} not yet` : `${name} ${formatMoney(value, currency)}`;
  });
  return `${date}, ${parts.join(', ')}`;
}
