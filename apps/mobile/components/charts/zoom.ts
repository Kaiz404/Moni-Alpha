import { useEffect, useRef } from 'react';
import {
  useSharedValue,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { springs } from '@/lib/motion/tokens';

/** The plot's pixel box: x from `left` to `right`, values from `base` (the low end) up to `top`. */
export type Frame = { left: number; right: number; top: number; base: number };

/**
 * What a chart shows for one range, in data space. x is in days from the index's first day, y in
 * minor units; `shift` is subtracted from every value first (Home's line reads "spent since the
 * range start").
 */
export type ZoomTarget = { from: number; to: number; low: number; high: number; shift: number };

export type Zoom = {
  from: SharedValue<number>;
  to: SharedValue<number>;
  low: SharedValue<number>;
  high: SharedValue<number>;
  shift: SharedValue<number>;
  /** The draw-in on first mount, 0 to 1; held at 1 under Reduce Motion. */
  reveal: SharedValue<number>;
  /** Reduce Motion: the marks fade in on mount and after each jump. */
  fade: SharedValue<number>;
};

export const PLOT_LEFT = 54;
const PLOT_RIGHT_INSET = 4;
const REDUCED_FADE = { duration: 180 };
/** How much of the draw-in the bars' left-to-right wave takes. */
const GROW_STAGGER = 0.6;
const BAR_GAP = 2;
const BAR_MIN_WIDTH = 3;
const BAR_MAX_WIDTH = 12;
const BAR_MIN_HEIGHT = 4;
/** Bars sit just above the baseline so its hairline stays visible. */
const BAR_LIFT = 0.7;

export function frameFor(width: number, top: number, base: number): Frame {
  return { left: PLOT_LEFT, right: width - PLOT_RIGHT_INSET, top, base };
}

export function xAt(u: number, from: number, to: number, frame: Frame): number {
  'worklet';
  const span = to - from;
  return span > 0 ? frame.left + ((u - from) / span) * (frame.right - frame.left) : frame.right;
}

export function yAt(value: number, low: number, high: number, frame: Frame): number {
  'worklet';
  const span = high - low;
  return frame.base - (span > 0 ? (value - low) / span : 0) * (frame.base - frame.top);
}

/** Finger x back to days, for the scrub. */
export function uAt(x: number, from: number, to: number, frame: Frame): number {
  'worklet';
  return from + ((x - frame.left) / (frame.right - frame.left)) * (to - from);
}

function round(value: number): number {
  'worklet';
  return Math.round(value * 10) / 10;
}

function clamp01(value: number): number {
  'worklet';
  return Math.max(0, Math.min(1, value));
}

/** The value at a fractional day, along the straight segment between two days. */
function valueAt(values: Float64Array, u: number): number {
  'worklet';
  const day = Math.floor(u);
  const part = u - day;
  if (part === 0 || day + 1 >= values.length) return values[day]!;
  return values[day]! + (values[day + 1]! - values[day]!) * part;
}

export type LinePath = { d: string; startX: number; endX: number };

/**
 * The line through `values[k]` at day k, cut to the viewport (cut at `reveal` of the way across
 * while it draws in). Inside it keeps at most one point per pixel column, the column's last, so a
 * frame costs the plot's width however long the history is. NaN days leave a gap.
 */
export function linePath(
  values: Float64Array,
  from: number,
  to: number,
  low: number,
  high: number,
  shift: number,
  frame: Frame,
  reveal: number,
): LinePath {
  'worklet';
  const count = values.length;
  const span = to - from;
  if (count === 0) return { d: '', startX: 0, endX: 0 };
  if (span <= 0) {
    // A lone day spans the plot, as its closing balance held all day.
    const value = values[Math.max(0, Math.min(count - 1, Math.round(from)))]!;
    if (value !== value) return { d: '', startX: 0, endX: 0 };
    const y = round(yAt(value - shift, low, high, frame));
    return { d: `M${frame.left},${y} L${frame.right},${y}`, startX: frame.left, endX: frame.right };
  }
  const start = Math.max(from, 0);
  const end = Math.min(from + span * clamp01(reveal), count - 1);
  let d = '';
  let open = false;
  let column = -Infinity;
  let pending = false;
  let px = 0;
  let py = 0;
  let startX = 0;
  let endX = 0;
  const flush = () => {
    if (!pending) return;
    if (d === '') startX = px;
    d += `${open ? ' L' : d === '' ? 'M' : ' M'}${round(px)},${round(py)}`;
    open = true;
    endX = px;
    pending = false;
  };
  const visit = (u: number, value: number) => {
    if (value !== value) {
      flush();
      open = false;
      column = -Infinity;
      return;
    }
    const x = xAt(u, from, to, frame);
    const at = Math.floor(x);
    if (at !== column) {
      flush();
      column = at;
    }
    px = x;
    py = yAt(value - shift, low, high, frame);
    pending = true;
  };
  if (end < start) return { d: '', startX: 0, endX: 0 };
  visit(start, valueAt(values, start));
  for (let day = Math.floor(start) + 1; day < end; day++) visit(day, values[day]!);
  if (end > start) visit(end, valueAt(values, end));
  flush();
  return { d, startX, endX };
}

/** The soft fill under a line, down to the plot's base. */
export function areaPath({ d, startX, endX }: LinePath, frame: Frame): string {
  'worklet';
  return d === '' ? '' : `${d} L${round(endX)},${frame.base} L${round(startX)},${frame.base} Z`;
}

function roundedRect(x0: number, x1: number, top: number, bottom: number): string {
  'worklet';
  const r = round(Math.min(6, (x1 - x0) / 2, (bottom - top) / 2));
  const [a, b, t, u] = [round(x0), round(x1), round(top), round(bottom)];
  return (
    `M${round(a + r)},${t} H${round(b - r)} A${r},${r} 0 0 1 ${b},${round(t + r)} ` +
    `V${round(u - r)} A${r},${r} 0 0 1 ${round(b - r)},${u} H${round(a + r)} ` +
    `A${r},${r} 0 0 1 ${a},${round(u - r)} V${round(t + r)} A${r},${r} 0 0 1 ${round(a + r)},${t} Z`
  );
}

/** Where one bucket's bar sits: centred on its days, as wide as they allow, 3 to 12. */
export function barBox(
  start: number,
  end: number,
  from: number,
  to: number,
  frame: Frame,
): { centre: number; width: number } {
  'worklet';
  const x0 = xAt(start, from, to, frame);
  const x1 = xAt(end + 1, from, to, frame);
  return {
    centre: (x0 + x1) / 2,
    width: Math.max(BAR_MIN_WIDTH, Math.min(BAR_MAX_WIDTH, x1 - x0 - BAR_GAP)),
  };
}

/** A bar's top in pixels: at least 4 tall, so an empty day still shows, grown by `grow` (0 to 1). */
export function barTop(value: number, high: number, frame: Frame, grow: number): number {
  'worklet';
  const bottom = frame.base - BAR_LIFT;
  return bottom - (Math.max(frame.base - yAt(value, 0, high, frame), BAR_MIN_HEIGHT) - BAR_LIFT) * grow;
}

/** The draw-in wave: bars on the left start growing first. */
export function growAt(x: number, frame: Frame, reveal: number): number {
  'worklet';
  const along = (x - frame.left) / (frame.right - frame.left);
  return clamp01(reveal * (1 + GROW_STAGGER) - GROW_STAGGER * along);
}

/**
 * One path for every bar in the viewport, each placed on its bucket's days so the bars move and
 * widen with the zoom. With `over` set, only the part of each bar above that value (Home's coral
 * over even pace). At most one bar per pixel column.
 */
export function barsPath(
  starts: Float64Array,
  ends: Float64Array,
  values: Float64Array,
  from: number,
  to: number,
  high: number,
  frame: Frame,
  grow: number,
  reveal: number,
  over: number | null,
): string {
  'worklet';
  if (to - from <= 0 || grow <= 0) return '';
  const overY = over === null ? 0 : yAt(over, 0, high, frame);
  let d = '';
  let column = -Infinity;
  for (let bucket = 0; bucket < starts.length; bucket++) {
    if (ends[bucket]! + 1 <= from || starts[bucket]! >= to) continue;
    const { centre, width } = barBox(starts[bucket]!, ends[bucket]!, from, to, frame);
    const x0 = Math.max(centre - width / 2, frame.left - 4);
    const x1 = Math.min(centre + width / 2, frame.right + 4);
    if (x1 - x0 < 0.5 || Math.floor(centre) === column) continue;
    column = Math.floor(centre);
    const top = barTop(values[bucket]!, high, frame, grow * growAt(centre, frame, reveal));
    const bottom = over === null ? frame.base - BAR_LIFT : overY;
    if (bottom - top < 0.5) continue;
    d += roundedRect(x0, x1, top, bottom);
  }
  return d;
}

/**
 * The viewport and y domain on the UI thread. Each change of target retargets the running
 * `value` spring from wherever it is, so a glide through the range chips never restarts it.
 * Reduce Motion jumps and fades the marks in over 180 ms.
 */
export function useZoom(target: ZoomTarget, reduceMotion: boolean): Zoom {
  const from = useSharedValue(target.from);
  const to = useSharedValue(target.to);
  const low = useSharedValue(target.low);
  const high = useSharedValue(target.high);
  const shift = useSharedValue(target.shift);
  const reveal = useSharedValue(reduceMotion ? 1 : 0);
  const fade = useSharedValue(reduceMotion ? 0 : 1);
  const mounted = useRef(false);

  useEffect(() => {
    if (reduceMotion) fade.set(withTiming(1, REDUCED_FADE));
    else reveal.set(withSpring(1, springs.value));
    // Draw in once on mount; later changes zoom.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const pairs = [
      [from, target.from],
      [to, target.to],
      [low, target.low],
      [high, target.high],
      [shift, target.shift],
    ] as const;
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    if (reduceMotion) {
      for (const [value, next] of pairs) value.set(next);
      fade.set(0);
      fade.set(withTiming(1, REDUCED_FADE));
      return;
    }
    for (const [value, next] of pairs) value.set(withSpring(next, springs.value));
  }, [target.from, target.to, target.low, target.high, target.shift, reduceMotion, from, to, low, high, shift, fade]);

  return { from, to, low, high, shift, reveal, fade };
}
