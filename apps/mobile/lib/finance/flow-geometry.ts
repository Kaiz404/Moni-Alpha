import { minorToNumber } from '@repo/types';

import { formatMoney } from '@/lib/finance/format-money';
import type { FlowBucket } from '@/lib/finance/flow-series';

export const FLOW_PLOT_HEIGHT = 96;
export const FLOW_TOP = 6;
export const FLOW_BASE = 92;
export const FLOW_AXIS = 44;
const MOST_BAR = 12;
const BAR_GAP = 2;
const SLOT_MARGIN = 2;
const FLOOR_MINOR = 1000;
const LABEL_CHAR = 6.5;
const LABEL_PADDING = 6;

export type FlowSlot = {
  key: string;
  /** The tappable column; its width is `FlowGeometry.slot`. */
  x: number;
  spentX: number;
  inX: number;
  /** Bar height in the plot; a non-zero amount never draws under 4. */
  spentHeight: number;
  inHeight: number;
  /** Null where the column is too narrow for every label to fit. */
  label: string | null;
};

export type FlowGeometry = {
  slot: number;
  bar: number;
  /** The width a shown label may take, centred on its column. */
  labelWidth: number;
  slots: FlowSlot[];
  /** The top gridline's label; the baseline is always zero. */
  topLabel: string;
  zeroLabel: string;
};

function niceCeil(value: number): number {
  const step = 10 ** Math.max(0, Math.floor(Math.log10(Math.max(value, 1))) - 1);
  return Math.ceil(value / step) * step;
}

function compactMoney(amount: number, currency: string): string {
  return amount >= 10_000
    ? `${formatMoney(Math.floor(amount / 1000) * 100, currency, { whole: true })}k`
    : formatMoney(Math.floor(amount) * 100, currency, { whole: true });
}

/** One column per bucket with a Spent bar and a Money in bar, on one shared zero-based axis. */
export function flowGeometry(
  buckets: readonly FlowBucket[],
  width: number,
  currency: string,
): FlowGeometry {
  const top = niceCeil(
    Math.max(FLOOR_MINOR, ...buckets.flatMap((bucket) => [bucket.spentMinor, bucket.inMinor])),
  );
  const span = FLOW_BASE - FLOW_TOP;
  const height = (minor: number) => (minor > 0 ? Math.max(4, (minor / top) * span) : 0);
  const slot = (width - FLOW_AXIS) / Math.max(buckets.length, 1);
  const bar = Math.max(2, Math.min(MOST_BAR, (slot - BAR_GAP - SLOT_MARGIN * 2) / 2));
  const pair = bar * 2 + BAR_GAP;
  const widest = Math.max(...buckets.map((bucket) => bucket.label.length)) * LABEL_CHAR + LABEL_PADDING;
  const every = Math.max(1, Math.ceil(widest / slot));
  return {
    slot,
    bar,
    labelWidth: slot * every,
    slots: buckets.map((bucket, index) => {
      const x = FLOW_AXIS + index * slot;
      const spentX = x + (slot - pair) / 2;
      return {
        key: bucket.key,
        x,
        spentX,
        inX: spentX + bar + BAR_GAP,
        spentHeight: height(bucket.spentMinor),
        inHeight: height(bucket.inMinor),
        label: index % every === 0 ? bucket.label : null,
      };
    }),
    topLabel: compactMoney(minorToNumber(top), currency),
    zeroLabel: formatMoney(0, currency, { whole: true }),
  };
}
