import { MONTHS, niceCeil } from '@/components/charts/pace-geometry';
import type { BubbleTint } from '@/components/ui/nav-row';
import { walletBubbleTint, walletLineColor } from '@/constants/wallet-card-styles';
import { dayLabel } from '@/lib/dates/day-label';
import { parseLocalDateInput } from '@/lib/dates/local-date-input';
import type { BalanceHistory } from '@/lib/finance/balance-history';
import { formatMoney } from '@/lib/finance/format-money';

export type NetWorthView = 'total' | 'by-wallet';

export type WalletLineStyle = { color: string; dash: string | undefined };

export type NetWorthLine = { id: string; ys: (number | null)[]; points: string };

export type NetWorthGeometry = {
  left: number;
  right: number;
  top: number;
  baseline: number;
  /** Pixels between days. Zero when the chart holds one day, which then spans the plot. */
  step: number;
  lines: NetWorthLine[];
  /** Total only: the soft fill under the line. */
  area: string | null;
  axis: { y: number; text: string }[];
  ticks: { x: number; text: string; align: 'start' | 'center' | 'end'; today: boolean }[];
  /** Days between scrub ticks, so a year does not buzz once per pixel. */
  tickEvery: number;
  accessibilityLabel: string;
};

const TOP = 44;
const BASELINE = 142;
const LEFT = 54;
const RIGHT_INSET = 4;
const MIN_TICK_PIXELS = 8;
const LONG_RANGE_DAYS = 180;
/** Wallets that share a colour stay apart by pattern, in list order. */
const DASHES = [undefined, '7 5', '1 6', '12 5 1 5'];

export function walletLineStyles(
  wallets: readonly { id: string; cardStyleId: string | null; type: string }[],
  dark: boolean,
): Record<string, WalletLineStyle> {
  const seen = new Map<BubbleTint, number>();
  return Object.fromEntries(
    wallets.map((wallet) => {
      const tint = walletBubbleTint(wallet.cardStyleId, wallet.type);
      const count = seen.get(tint) ?? 0;
      seen.set(tint, count + 1);
      return [
        wallet.id,
        { color: walletLineColor(tint, dark), dash: DASHES[count % DASHES.length] },
      ];
    }),
  );
}

function tickDate(key: string, long: boolean): string {
  const date = parseLocalDateInput(key)!;
  const month = MONTHS[date.getMonth()];
  return long ? `${month} ${date.getFullYear()}` : `${date.getDate()} ${month}`;
}

/**
 * Pure layout on a `width` x 150 plot. The first day sits on the left edge and today on the right
 * for every range, so the line always fills the plot.
 */
export function netWorthGeometry({
  history: { days, total, byWallet },
  view,
  names,
  width,
  currency,
}: {
  history: BalanceHistory;
  view: NetWorthView;
  /** Wallet id to the name the key shows, in key order. */
  names: Record<string, string>;
  width: number;
  currency: string;
}): NetWorthGeometry {
  const count = days.length;
  const last = count - 1;
  const right = width - RIGHT_INSET;
  const step = count > 1 ? (right - LEFT) / last : 0;
  const xOf = (index: number) => (count > 1 ? LEFT + index * step : right);

  const ids = Object.keys(names);
  const series: { id: string; values: readonly (number | null)[] }[] =
    view === 'total'
      ? [{ id: 'total', values: total }]
      : ids.map((id) => ({ id, values: byWallet[id] ?? [] }));
  const shown = series.flatMap(({ values }) =>
    values.filter((value): value is number => value !== null),
  );
  const low = Math.min(...shown);
  const high = Math.max(...shown);
  const unit = niceCeil(Math.max(100, (high - low) / 2));
  const floor = Math.floor(low / unit) * unit;
  const ceiling = Math.max(floor + unit * 2, Math.ceil(high / unit) * unit);
  const yOf = (minor: number) =>
    BASELINE - ((minor - floor) / (ceiling - floor)) * (BASELINE - TOP);
  const axisMoney = (minor: number) => formatMoney(minor, currency, { whole: true });

  const lines = series.map(({ id, values }) => {
    const ys = values.map((value) => (value === null ? null : yOf(value)));
    const drawn = ys.flatMap((y, index) => (y === null ? [] : [`${xOf(index)},${y}`]));
    // A lone day spans the plot, as its closing balance held all day.
    const points = count === 1 ? `${LEFT},${ys[0]} ${right},${ys[0]}` : drawn.join(' ');
    return { id, ys, points };
  });

  const long = last > LONG_RANGE_DAYS;
  const middle = Math.floor(last / 2);
  const ticks: NetWorthGeometry['ticks'] = [
    ...(count > 1
      ? [{ x: LEFT, text: tickDate(days[0]!, long), align: 'start' as const, today: false }]
      : []),
    ...(count >= 5
      ? [
          {
            x: xOf(middle),
            text: tickDate(days[middle]!, long),
            align: 'center' as const,
            today: false,
          },
        ]
      : []),
    { x: right, text: 'Today', align: 'end', today: true },
  ];

  const money = (minor: number) => formatMoney(minor, currency);
  const span = count > 1 ? `${tickDate(days[0]!, count > LONG_RANGE_DAYS)} to today` : 'today';
  const reading =
    view === 'total'
      ? `Net worth, ${span}${count > 1 ? `, from ${money(total[0]!)} to ${money(total[last]!)}` : `, ${money(total[last]!)}`}.`
      : `Net worth by wallet, ${span}. ${ids
          .map((id) => `${names[id]} ${money(byWallet[id]?.[last] ?? 0)}`)
          .join(', ')}.`;

  return {
    left: LEFT,
    right,
    top: TOP,
    baseline: BASELINE,
    step,
    lines,
    area:
      view === 'total'
        ? `M${LEFT},${BASELINE} L${lines[0]!.points.replaceAll(' ', ' L')} L${right},${BASELINE} Z`
        : null,
    axis: [
      { y: TOP, text: axisMoney(ceiling) },
      { y: (TOP + BASELINE) / 2, text: axisMoney((ceiling + floor) / 2) },
      { y: BASELINE, text: axisMoney(floor) },
    ],
    ticks,
    tickEvery: step > 0 ? Math.max(1, Math.ceil(MIN_TICK_PIXELS / step)) : 1,
    accessibilityLabel:
      floor === 0 ? reading : `${reading} The axis starts at ${axisMoney(floor)}, not zero.`,
  };
}

/** The screen reader's value for a day: its date, then what each line reads there. */
export function dayReading(
  history: BalanceHistory,
  index: number,
  view: NetWorthView,
  names: Record<string, string>,
  currency: string,
  now: Date,
): string {
  const date = dayLabel(history.days[index]!, now);
  if (view === 'total') return `${date}, ${formatMoney(history.total[index]!, currency)}`;
  const parts = Object.entries(names).map(([id, name]) => {
    const value = history.byWallet[id]?.[index] ?? null;
    return value === null ? `${name} not yet` : `${name} ${formatMoney(value, currency)}`;
  });
  return `${date}, ${parts.join(', ')}`;
}
