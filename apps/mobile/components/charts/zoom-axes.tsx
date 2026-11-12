import { useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Line } from 'react-native-svg';

import { Text } from '@/components/ui/text';

import { AXIS_LABEL_OVERHANG, AXIS_WIDTH, PLOT_HEIGHT } from './pace-geometry';
import { xAt, yAt, type Frame, type Zoom } from './zoom';

const AnimatedLine = Animated.createAnimatedComponent(Line);

/** Labels and lines fade over this long as they arrive or leave, sliding with the zoom throughout. */
const TICK_SWAP_MS = 150;
export const LABEL_IN = FadeIn.duration(TICK_SWAP_MS);
export const LABEL_OUT = FadeOut.duration(TICK_SWAP_MS);

/**
 * A y value the axis marks: its gridline (`line`) and its label (`text`), either of which may be
 * missing. Rows ride their value, so they slide with the marks as the y domain zooms.
 */
export type AxisRow = { value: number; text: string | null; line: 'solid' | 'dashed' | null };

/** An x label anchored to a day position, in days from the index's first day. */
export type TickMark = { u: number; label: string };

const TICK_WIDTH = 60;
/** Any tick this close to Today hides (tokens.md Charts). */
const TODAY_CLEARANCE = 52;
/** A tick or row fades over this many pixels as it nears Today or leaves the plot. */
const TICK_FADE = 8;

const rowKey = (row: AxisRow) => `${row.value}:${row.text}:${row.line}`;
const tickKey = (tick: TickMark) => `${tick.u}:${tick.label}`;

/**
 * Items the target dropped, kept mounted until their fade ends so they keep sliding with the
 * zoom; a layout `exiting` animation would freeze them where they were.
 */
function useLeaving<T>(items: readonly T[], keyOf: (item: T) => string): T[] {
  const [leaving, setLeaving] = useState<T[]>([]);
  const previous = useRef(items);
  useEffect(() => {
    const kept = new Set(items.map(keyOf));
    const dropped = previous.current.filter((item) => !kept.has(keyOf(item)));
    previous.current = items;
    const droppedKeys = new Set(dropped.map(keyOf));
    setLeaving((current) => [
      ...current.filter((item) => !kept.has(keyOf(item)) && !droppedKeys.has(keyOf(item))),
      ...dropped,
    ]);
    if (dropped.length)
      setTimeout(
        () => setLeaving((current) => current.filter((item) => !droppedKeys.has(keyOf(item)))),
        TICK_SWAP_MS,
      );
    // keyOf is a module-level function.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);
  const kept = new Set(items.map(keyOf));
  return leaving.filter((item) => !kept.has(keyOf(item)));
}

/** True after the first render, so what a chart shows on mount does not fade in. */
function useMounted(): boolean {
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
  }, []);
  return mounted.current;
}

/** 1 while an item stays, easing to 0 once it leaves; from 0 if it arrived after mount. */
function useShown(leaving: boolean, appear: boolean) {
  const shown = useSharedValue(appear ? 0 : 1);
  useEffect(() => {
    shown.set(withTiming(leaving ? 0 : 1, { duration: TICK_SWAP_MS }));
  }, [leaving, shown]);
  return shown;
}

/** A row's pixel y on the live y domain, and how much of it shows inside the plot's height. */
function rowAt(value: number, low: number, high: number, frame: Frame): { y: number; inside: number } {
  'worklet';
  const y = yAt(value, low, high, frame);
  const outside = Math.max(frame.top - y, y - frame.base, 0);
  return { y, inside: Math.max(0, 1 - outside / TICK_FADE) };
}

/**
 * The y labels, each riding its value on the live y domain. The target's new values slide in
 * from where they sit on the old scale as they fade in; dropped ones keep sliding as they fade.
 */
export function YLabels({
  rows,
  zoom,
  frame,
  fit = false,
}: {
  rows: readonly AxisRow[];
  zoom: Zoom;
  frame: Frame;
  fit?: boolean;
}) {
  const labelled = useMemo(() => rows.filter((row) => row.text !== null), [rows]);
  const leaving = useLeaving(labelled, rowKey);
  const appear = useMounted();
  const shared = { appear, zoom, frame, fit };
  return (
    <>
      {labelled.map((row) => (
        <YLabel
          key={rowKey(row)}
          row={row}
          leaving={false}
          {...shared}
        />
      ))}
      {leaving.map((row) => (
        <YLabel
          key={rowKey(row)}
          row={row}
          leaving
          {...shared}
        />
      ))}
    </>
  );
}

function YLabel({
  row: { value, text },
  leaving,
  appear,
  zoom: { low, high },
  frame,
  fit,
}: {
  row: AxisRow;
  leaving: boolean;
  appear: boolean;
  zoom: Zoom;
  frame: Frame;
  fit: boolean;
}) {
  const shown = useShown(leaving, appear);
  const place = useAnimatedStyle(() => {
    const { y, inside } = rowAt(value, low.get(), high.get(), frame);
    return { opacity: shown.get() * inside, transform: [{ translateY: y - 8 }] };
  });
  return (
    <Animated.View
      pointerEvents="none"
      className="absolute top-0"
      style={[{ left: -AXIS_LABEL_OVERHANG, width: AXIS_WIDTH + AXIS_LABEL_OVERHANG }, place]}
    >
      <Text
        variant="smallest"
        numberOfLines={1}
        adjustsFontSizeToFit={fit}
        className="text-right text-muted"
      >
        {text}
      </Text>
    </Animated.View>
  );
}

/** The gridlines, each riding its value like its label: solid in Hairline, dashed in Sand light. */
export function YGrid({
  rows,
  zoom,
  frame,
  width,
  left,
  solid,
  dashed,
}: {
  rows: readonly AxisRow[];
  zoom: Zoom;
  frame: Frame;
  width: number;
  /** Bars' lines start here and run to the card edge; otherwise they span the plot. */
  left?: number;
  solid: string;
  dashed: string;
}) {
  const lined = useMemo(() => rows.filter((row) => row.line !== null), [rows]);
  const leaving = useLeaving(lined, rowKey);
  const appear = useMounted();
  const shared = {
    appear,
    zoom,
    frame,
    x1: left ?? frame.left,
    x2: left === undefined ? frame.right : width,
    solid,
    dashed,
  };
  return (
    <Svg
      width={width}
      height={PLOT_HEIGHT}
      style={{ position: 'absolute' }}
    >
      {lined.map((row) => (
        <GridLine
          key={rowKey(row)}
          row={row}
          leaving={false}
          {...shared}
        />
      ))}
      {leaving.map((row) => (
        <GridLine
          key={rowKey(row)}
          row={row}
          leaving
          {...shared}
        />
      ))}
    </Svg>
  );
}

function GridLine({
  row: { value, line },
  leaving,
  appear,
  zoom: { low, high },
  frame,
  x1,
  x2,
  solid,
  dashed,
}: {
  row: AxisRow;
  leaving: boolean;
  appear: boolean;
  zoom: Zoom;
  frame: Frame;
  x1: number;
  x2: number;
  solid: string;
  dashed: string;
}) {
  const shown = useShown(leaving, appear);
  const props = useAnimatedProps(() => {
    const { y, inside } = rowAt(value, low.get(), high.get(), frame);
    return { y1: y, y2: y, opacity: shown.get() * inside };
  });
  return (
    <AnimatedLine
      x1={x1}
      x2={x2}
      stroke={line === 'dashed' ? dashed : solid}
      strokeWidth={1.5}
      strokeDasharray={line === 'dashed' ? '3 5' : undefined}
      animatedProps={props}
    />
  );
}

/**
 * The x axis: each tick slides with its date as the chart zooms, the target range's set fades in
 * and the old set fades out, and Today stays bold where today is.
 */
export function ZoomTicks({
  ticks,
  todayU,
  zoom,
  frame,
  width,
}: {
  ticks: readonly TickMark[];
  todayU: number;
  zoom: Zoom;
  frame: Frame;
  width: number;
}) {
  const leaving = useLeaving(ticks, tickKey);
  const appear = useMounted();
  const shared = { todayU, zoom, frame, width, appear };
  return (
    <View style={{ height: 16 }}>
      {ticks.map((tick) => (
        <Tick
          key={tickKey(tick)}
          u={tick.u}
          label={tick.label}
          leaving={false}
          {...shared}
        />
      ))}
      {leaving.map((tick) => (
        <Tick
          key={tickKey(tick)}
          u={tick.u}
          label={tick.label}
          leaving
          {...shared}
        />
      ))}
      <Tick
        key="today"
        u={todayU}
        label="Today"
        leaving={false}
        {...shared}
        todayU={null}
      />
    </View>
  );
}

function Tick({
  u,
  label,
  leaving,
  appear,
  todayU,
  zoom,
  frame,
  width,
}: {
  u: number;
  label: string;
  leaving: boolean;
  /** Fades in on mount; false for the ticks shown when the chart first appears. */
  appear: boolean;
  /** Null for the Today tick itself. */
  todayU: number | null;
  zoom: Zoom;
  frame: Frame;
  width: number;
}) {
  const { from, to } = zoom;
  const shown = useShown(leaving, appear);
  const place = useAnimatedStyle(() => {
    const x = xAt(u, from.get(), to.get(), frame);
    const outside = Math.max(frame.left - x, x - frame.right, 0);
    let opacity = shown.get() * Math.max(0, 1 - outside / TICK_FADE);
    if (todayU !== null) {
      const gap = Math.abs(x - xAt(todayU, from.get(), to.get(), frame));
      opacity *= Math.max(0, Math.min(1, (gap - TODAY_CLEARANCE) / TICK_FADE));
    }
    return {
      opacity,
      transform: [
        {
          translateX: Math.max(
            AXIS_WIDTH - 4,
            Math.min(width - TICK_WIDTH, x - TICK_WIDTH / 2),
          ),
        },
      ],
    };
  });
  return (
    <Animated.View
      className="absolute left-0 top-0"
      style={[{ width: TICK_WIDTH }, place]}
    >
      <Text
        variant="smallest"
        numberOfLines={1}
        className={`text-center ${todayU === null ? 'font-display-bold text-foreground' : 'text-muted'}`}
      >
        {label}
      </Text>
    </Animated.View>
  );
}
