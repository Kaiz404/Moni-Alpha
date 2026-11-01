import { minorToNumber } from '@repo/types';

import { monthShort, type MonthKey } from '@/lib/finance/budget-month';
import { formatMoney } from '@/lib/finance/format-money';

import type { ReportMonth } from './report';

export const TREND_PLOT_HEIGHT = 150;
export const TREND_TOP = 44;
export const TREND_BASE = 141.25;
export const TREND_AXIS = 50;
export const TREND_BAR = 12;
const BAR_GAP = 2;
const FLOOR_MINOR = 1000;

export type TrendSlot = {
  month: MonthKey;
  /** The tappable column; its width is `TrendGeometry.slot`. */
  x: number;
  spentX: number;
  inX: number;
  /** Bar height in the plot; a non-zero amount never draws under 6. */
  spentHeight: number;
  inHeight: number;
  label: string;
  selected: boolean;
};

export type TrendGeometry = {
  slot: number;
  slots: TrendSlot[];
  /** The top gridline's label; the baseline is always zero. */
  topLabel: string;
  zeroLabel: string;
};

function niceCeil(value: number): number {
  const step = 10 ** Math.max(0, Math.floor(Math.log10(Math.max(value, 1))) - 1);
  return Math.ceil(value / step) * step;
}

/** One column per month with a Spent bar and a Money in bar, on one shared zero-based axis. */
export function trendGeometry(
  trend: readonly ReportMonth[],
  width: number,
  selected: MonthKey | null,
  currency: string,
): TrendGeometry {
  const top = niceCeil(
    Math.max(FLOOR_MINOR, ...trend.flatMap((row) => [row.spentMinor, row.inMinor])),
  );
  const span = TREND_BASE - TREND_TOP;
  const height = (minor: number) => (minor > 0 ? Math.max(6, (minor / top) * span) : 0);
  const slot = (width - TREND_AXIS) / Math.max(trend.length, 1);
  const pair = TREND_BAR * 2 + BAR_GAP;
  return {
    slot,
    slots: trend.map((row, index) => {
      const x = TREND_AXIS + index * slot;
      const spentX = x + (slot - pair) / 2;
      return {
        month: row.month,
        x,
        spentX,
        inX: spentX + TREND_BAR + BAR_GAP,
        spentHeight: height(row.spentMinor),
        inHeight: height(row.inMinor),
        label: monthShort(row.month),
        selected: row.month === selected,
      };
    }),
    topLabel: compactMoney(minorToNumber(top), currency),
    zeroLabel: formatMoney(0, currency, { whole: true }),
  };
}

function compactMoney(amount: number, currency: string): string {
  return amount >= 10_000
    ? `${formatMoney(Math.floor(amount / 1000) * 100, currency, { whole: true })}k`
    : formatMoney(Math.floor(amount) * 100, currency, { whole: true });
}
