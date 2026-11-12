import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  FadeIn,
  FadeOut,
  LayoutAnimationConfig,
  useAnimatedProps,
  useAnimatedStyle,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { Text } from '@/components/ui/text';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import type { ChartRange } from '@/lib/finance/chart-range';
import type { SpendBuckets, SpendIndex } from '@/lib/finance/spend-history';
import { springs } from '@/lib/motion/tokens';
import { tid, type Screen } from '@/lib/test-ids';

import {
  AXIS_LABEL_OVERHANG,
  AXIS_WIDTH,
  PLOT_HEIGHT,
  calloutLeft,
  type PaceChartMode,
} from './pace-geometry';
import {
  BAR_BASE,
  LINE_BASE,
  SPEND_TOP,
  monthMarks,
  spendReading,
  spendTarget,
  whole,
  type MonthMarks,
  type SpendMonth,
  type SpendTarget,
} from './spend-geometry';
import { Tip, useChartScrub } from './scrub';
import {
  areaPath,
  barBox,
  barTop,
  barsPath,
  frameFor,
  growAt,
  linePath,
  useZoom,
  xAt,
  yAt,
  type Frame,
  type Zoom,
} from './zoom';
import { LABEL_IN, LABEL_OUT, YLabels, ZoomTicks } from './zoom-axes';

type Tokens = ReturnType<typeof useThemeTokens>;

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedLine = Animated.createAnimatedComponent(Line);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedRect = Animated.createAnimatedComponent(Rect);

const DEFAULT_WIDTH = 314;
const GUIDE_TOP = 38;
const MODE_IN = FadeIn.duration(180);
const MODE_OUT = FadeOut.duration(180);
/** A bar set whose unit changed fades out while the new set grows. */
const BARS_OUT = FadeOut.duration(120);
const MONTH_FADE = { duration: 150 };

function clamp01(value: number): number {
  'worklet';
  return Math.max(0, Math.min(1, value));
}

/**
 * Home's spent card chart for every range: the running total (Pace) or bars (Daily). The data is
 * indexed once; a range change zooms the x and y axes to the new range on one spring, retargeted
 * mid-flight, and 1M adds the month's budget marks.
 */
export function SpendChart({
  screen,
  index,
  now,
  range,
  mode,
  month,
  currency,
}: {
  screen: Screen;
  index: SpendIndex;
  now: Date;
  range: ChartRange;
  mode: PaceChartMode;
  month: SpendMonth;
  currency: string;
}) {
  const tokens = useThemeTokens();
  const reduceMotion = useReducedMotion();
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const target = useMemo(
    () => spendTarget({ index, now, range, mode, month, currency }),
    [index, now, range, mode, month, currency],
  );
  const marks = useMemo(() => monthMarks(index, now, month), [index, now, month]);
  const zoom = useZoom(
    { from: target.from, to: target.to, low: 0, high: target.high, shift: target.shift },
    reduceMotion,
  );
  const frame = useMemo(
    () => frameFor(width, SPEND_TOP, mode === 'daily' ? BAR_BASE : LINE_BASE),
    [width, mode],
  );
  const oneMonth = useSharedValue(target.oneMonth ? 1 : 0);
  useEffect(() => {
    oneMonth.set(withTiming(target.oneMonth ? 1 : 0, MONTH_FADE));
  }, [target.oneMonth, oneMonth]);

  // A finger's pick shows the tooltip until it lifts; a screen reader's only moves the spoken value.
  const key = `${range}:${mode}`;
  const [pick, setPick] = useState<{ key: string; id: number; by: 'finger' | 'reader' } | null>(null);
  const { points, buckets } = target;
  const current = pick?.key === key ? pick : null;
  const selected = current?.id ?? points.ids[points.ids.length - 1]!;
  const held = current?.by === 'finger';
  const { gesture, point, shown } = useChartScrub({
    testID: tid(screen, 'chart'),
    points,
    zoom,
    frame,
    onPoint: (id) => setPick(id === null ? null : { key, id, by: 'finger' }),
  });
  const nudge = (by: number) => {
    const next = points.ids.indexOf(selected) + by;
    if (next >= 0 && next < points.ids.length) setPick({ key, id: points.ids[next]!, by: 'reader' });
  };

  const daily = mode === 'daily';
  const reading = spendReading(index, target, selected, currency);

  return (
    <View
      testID={tid(screen, 'pace-chart')}
      className="gap-1.5"
    >
      <View
        style={{ height: PLOT_HEIGHT }}
        onLayout={(event) => setWidth(Math.round(event.nativeEvent.layout.width))}
      >
        {daily && held ? (
          <Tip shown={shown}>
            <Band
              target={target}
              cumulative={index.cumulative}
              point={point}
              zoom={zoom}
              frame={frame}
            />
          </Tip>
        ) : null}
        <LayoutAnimationConfig skipEntering>
          <Animated.View
            key={mode}
            entering={MODE_IN}
            exiting={MODE_OUT}
            pointerEvents="none"
            className="absolute inset-0"
          >
            {daily ? (
              <BarMarks
                buckets={buckets}
                marks={marks}
                today={index.days - 1}
                spent={index.spent}
                zoom={zoom}
                frame={frame}
                width={width}
                oneMonth={oneMonth}
                reduceMotion={reduceMotion}
                tokens={tokens}
              />
            ) : (
              <LineMarks
                cumulative={index.cumulative}
                marks={marks}
                zoom={zoom}
                frame={frame}
                width={width}
                oneMonth={oneMonth}
                tokens={tokens}
              />
            )}
          </Animated.View>
        </LayoutAnimationConfig>
        <YLabels rows={target.rows} />
        <LayoutAnimationConfig skipEntering>
          {target.oneMonth && !daily && marks.budget !== null ? (
            <>
              <FloatingLabel
                key="budget"
                testID={tid(screen, 'chart', 'budget')}
                value={marks.shift + marks.budget}
                shifted
                zoom={zoom}
                frame={frame}
                className="font-display-bold text-deep-mint"
                text={whole(marks.budget, currency)}
              />
              <FloatingLabel
                key="budget-word"
                value={marks.shift + marks.budget}
                shifted
                zoom={zoom}
                frame={frame}
                className="font-display-bold text-deep-mint"
                text="Budget"
                right
              />
            </>
          ) : null}
          {target.oneMonth && daily && marks.evenPace !== null ? (
            <FloatingLabel
              key="even-pace"
              testID={tid(screen, 'chart', 'even-pace')}
              value={marks.evenPace}
              shifted={false}
              zoom={zoom}
              frame={frame}
              className="font-display-bold text-foreground"
              text={whole(marks.evenPace, currency)}
            />
          ) : null}
        </LayoutAnimationConfig>
        {held ? (
          <Tip shown={shown}>
            <Selection
              screen={screen}
              target={target}
              cumulative={index.cumulative}
              point={point}
              zoom={zoom}
              frame={frame}
              width={width}
              tokens={tokens}
              date={reading.date}
              value={reading.value}
            />
          </Tip>
        ) : null}
        <GestureDetector gesture={gesture}>
          <View
            testID={tid(screen, 'chart', 'plot')}
            accessible
            accessibilityRole="adjustable"
            accessibilityLabel={target.accessibilityLabel}
            accessibilityValue={{ text: reading.accessibilityLabel }}
            accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
            onAccessibilityAction={(event) =>
              nudge(event.nativeEvent.actionName === 'increment' ? 1 : -1)
            }
            className="absolute inset-0"
          />
        </GestureDetector>
      </View>
      <ZoomTicks
        ticks={target.ticks}
        todayU={target.todayU}
        zoom={zoom}
        frame={frame}
        width={width}
      />
    </View>
  );
}

/** A label that rides a value on the y axis (the budget, the even pace) as the chart zooms. */
function FloatingLabel({
  testID,
  value,
  shifted,
  zoom: { low, high, shift },
  frame,
  className,
  text,
  right = false,
}: {
  testID?: string;
  value: number;
  /** Measured from the range start, like the Pace line. */
  shifted: boolean;
  zoom: Zoom;
  frame: Frame;
  className: string;
  text: string;
  /** "Budget" sits above the line at the right edge instead of in the axis column. */
  right?: boolean;
}) {
  const place = useAnimatedStyle(() => ({
    transform: [
      {
        translateY:
          yAt(value - (shifted ? shift.get() : 0), low.get(), high.get(), frame) - (right ? 20 : 8),
      },
    ],
  }));
  return (
    <Animated.View
      entering={LABEL_IN}
      exiting={LABEL_OUT}
      pointerEvents="none"
      className="absolute top-0"
      style={[
        right
          ? { right: 0 }
          : { left: -AXIS_LABEL_OVERHANG, width: AXIS_WIDTH + AXIS_LABEL_OVERHANG },
        place,
      ]}
    >
      <Text
        testID={testID}
        variant="smallest"
        numberOfLines={1}
        className={`${right ? '' : 'text-right'} ${className}`}
      >
        {text}
      </Text>
    </Animated.View>
  );
}

/** Pace: the running total since the range start, its fill, and on 1M the budget and even pace. */
const LineMarks = memo(function LineMarks({
  cumulative,
  marks,
  zoom: { from, to, low, high, shift, reveal, fade },
  frame,
  width,
  oneMonth,
  tokens,
}: {
  cumulative: Float64Array;
  marks: MonthMarks;
  zoom: Zoom;
  frame: Frame;
  width: number;
  oneMonth: SharedValue<number>;
  tokens: Tokens;
}) {
  const line = useDerivedValue(() =>
    linePath(
      cumulative,
      from.get(),
      to.get(),
      low.get(),
      high.get(),
      shift.get(),
      frame,
      reveal.get(),
    ),
  );
  const lineProps = useAnimatedProps(() => ({ d: line.get().d, opacity: fade.get() }));
  const areaProps = useAnimatedProps(() => ({
    d: areaPath(line.get(), frame),
    opacity: 0.8 * fade.get(),
  }));
  const { budget } = marks;
  const budgetValue = budget === null ? 0 : marks.shift + budget;
  const budgetLine = useAnimatedProps(() => {
    const y = yAt(budgetValue - shift.get(), low.get(), high.get(), frame);
    // On the top gridline the budget is that line, as the boards draw it; only its dot shows.
    return { y1: y, y2: y, opacity: oneMonth.get() * clamp01(Math.abs(y - frame.top) / 4) };
  });
  const budgetDot = useAnimatedProps(() => ({
    cx: xAt(marks.to, from.get(), to.get(), frame),
    cy: yAt(budgetValue - shift.get(), low.get(), high.get(), frame),
    opacity: oneMonth.get(),
  }));
  const evenPace = useAnimatedProps(() => {
    const [f, t] = [from.get(), to.get()];
    const x1 = xAt(marks.from, f, t, frame);
    const x2 = xAt(marks.to, f, t, frame);
    const y1 = yAt(marks.shift - shift.get(), low.get(), high.get(), frame);
    const y2 = yAt(budgetValue - shift.get(), low.get(), high.get(), frame);
    // Cut to the plot, so the line never runs into the axis column while it zooms away.
    const along = (x: number) => (x2 === x1 ? 0 : (x - x1) / (x2 - x1));
    const start = clamp01(along(frame.left));
    const end = clamp01(along(frame.right));
    return {
      x1: x1 + (x2 - x1) * start,
      y1: y1 + (y2 - y1) * start,
      x2: x1 + (x2 - x1) * end,
      y2: y1 + (y2 - y1) * end,
      opacity: oneMonth.get(),
    };
  });
  const middle = (frame.top + frame.base) / 2;
  return (
    <Svg
      width={width}
      height={PLOT_HEIGHT}
    >
      <Line x1={frame.left} y1={frame.top} x2={frame.right} y2={frame.top} stroke={tokens.hairline} strokeWidth={1.5} />
      <Line
        x1={frame.left}
        y1={middle}
        x2={frame.right}
        y2={middle}
        stroke={tokens.sandLight}
        strokeWidth={1.5}
        strokeDasharray="3 5"
      />
      <Line x1={frame.left} y1={frame.base} x2={frame.right} y2={frame.base} stroke={tokens.hairline} strokeWidth={1.5} />
      {budget !== null ? (
        <AnimatedLine
          x1={frame.left}
          x2={frame.right}
          stroke={tokens.deepMint}
          strokeWidth={1.5}
          animatedProps={budgetLine}
        />
      ) : null}
      <AnimatedPath
        fill={tokens.sand}
        animatedProps={areaProps}
      />
      {budget !== null ? (
        <AnimatedLine
          stroke={tokens.inactive}
          strokeWidth={1.5}
          strokeDasharray="5 5"
          animatedProps={evenPace}
        />
      ) : null}
      <AnimatedPath
        fill="none"
        stroke={tokens.foreground}
        strokeWidth={3}
        strokeLinejoin="round"
        strokeLinecap="round"
        animatedProps={lineProps}
      />
      {budget !== null ? (
        <AnimatedCircle
          r={5}
          fill={tokens.deepMint}
          stroke={tokens.card}
          strokeWidth={2}
          animatedProps={budgetDot}
        />
      ) : null}
    </Svg>
  );
});

/**
 * Daily: one bar per bucket. A set stays while the unit does, moving and widening with the zoom;
 * a new unit mounts a new set that grows in while the old one fades out.
 */
const BarMarks = memo(function BarMarks({
  buckets,
  marks,
  today,
  spent,
  zoom,
  frame,
  width,
  oneMonth,
  reduceMotion,
  tokens,
}: {
  buckets: SpendBuckets;
  marks: MonthMarks;
  today: number;
  spent: Float64Array;
  zoom: Zoom;
  frame: Frame;
  width: number;
  oneMonth: SharedValue<number>;
  reduceMotion: boolean;
  tokens: Tokens;
}) {
  // The set shown on mount draws in with the chart; every later set grows in on its own.
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
  }, []);
  const { from, to, high, reveal } = zoom;
  const { evenPace, safePerDay } = marks;
  const even = useAnimatedProps(() => {
    const y = yAt(evenPace ?? 0, 0, high.get(), frame);
    return { y1: y, y2: y, opacity: oneMonth.get() };
  });
  const safe = useAnimatedProps(() => {
    const { centre, width: barWidth } = barBox(today, today, from.get(), to.get(), frame);
    const top = barTop(spent[today]!, high.get(), frame, growAt(centre, frame, reveal.get()));
    const height = Math.max(frame.base - yAt(safePerDay ?? 0, 0, high.get(), frame), 6);
    return {
      x: centre - barWidth / 2,
      y: top - 2 - height,
      width: barWidth,
      height,
      opacity: oneMonth.get(),
    };
  });
  return (
    <>
      <Svg
        width={width}
        height={PLOT_HEIGHT}
        style={{ position: 'absolute' }}
      >
        <Line x1={50} y1={frame.top} x2={width} y2={frame.top} stroke={tokens.sandLight} strokeWidth={1.5} strokeDasharray="3 5" />
        <Line x1={50} y1={frame.base} x2={width} y2={frame.base} stroke={tokens.hairline} strokeWidth={1.5} />
      </Svg>
      <Animated.View
        key={buckets.key}
        exiting={BARS_OUT}
        className="absolute inset-0"
      >
        <BarSet
          buckets={buckets}
          over={buckets.unit === 'day' ? evenPace : null}
          zoom={zoom}
          frame={frame}
          width={width}
          grown={reduceMotion || !mounted.current}
          oneMonth={oneMonth}
          tokens={tokens}
        />
      </Animated.View>
      <Svg
        width={width}
        height={PLOT_HEIGHT}
        style={{ position: 'absolute' }}
      >
        {safePerDay !== null ? (
          <AnimatedRect
            rx={6}
            fill={tokens.card}
            stroke={tokens.foreground}
            strokeWidth={1.2}
            strokeDasharray="2 2"
            animatedProps={safe}
          />
        ) : null}
        {evenPace !== null ? (
          <AnimatedLine
            x1={50}
            x2={width}
            stroke={tokens.foreground}
            strokeWidth={1.5}
            strokeDasharray="4 4"
            animatedProps={even}
          />
        ) : null}
      </Svg>
    </>
  );
});

function BarSet({
  buckets: { starts, ends, values },
  over,
  zoom: { from, to, high, reveal, fade },
  frame,
  width,
  grown,
  oneMonth,
  tokens,
}: {
  buckets: SpendBuckets;
  /** Day bars: the part above the even pace turns Coral on 1M. */
  over: number | null;
  zoom: Zoom;
  frame: Frame;
  width: number;
  /** The first set draws in with the chart; a later one grows in on its own. */
  grown: boolean;
  oneMonth: SharedValue<number>;
  tokens: Tokens;
}) {
  const grow = useSharedValue(grown ? 1 : 0);
  useEffect(() => {
    if (!grown) grow.set(withSpring(1, springs.value));
    // Grow once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const ink = useAnimatedProps(() => ({
    d: barsPath(starts, ends, values, from.get(), to.get(), high.get(), frame, grow.get(), reveal.get(), null),
    opacity: fade.get(),
  }));
  const coral = useAnimatedProps(() => ({
    d: barsPath(starts, ends, values, from.get(), to.get(), high.get(), frame, grow.get(), reveal.get(), over),
    opacity: fade.get() * oneMonth.get(),
  }));
  return (
    <Svg
      width={width}
      height={PLOT_HEIGHT}
    >
      <AnimatedPath
        fill={tokens.foreground}
        animatedProps={ink}
      />
      {over !== null ? (
        <AnimatedPath
          fill={tokens.coral}
          animatedProps={coral}
        />
      ) : null}
    </Svg>
  );
}

/** Where the scrubbed point or bar is, from the live viewport, so the tooltip rides the zoom. */
function useAnchor(target: SpendTarget, cumulative: Float64Array, point: SharedValue<number>, zoom: Zoom, frame: Frame) {
  const {
    mode,
    buckets,
    points: { at, ids },
  } = target;
  const { from, to, high, shift } = zoom;
  return useDerivedValue(() => {
    const [f, t] = [from.get(), to.get()];
    const index = Math.min(point.get(), ids.length - 1);
    const id = ids[index]!;
    if (mode === 'daily') {
      const { centre } = barBox(buckets.starts[id]!, buckets.ends[id]!, f, t, frame);
      return { x: centre, y: barTop(buckets.values[id]!, high.get(), frame, 1) };
    }
    return { x: xAt(at[index]!, f, t, frame), y: yAt(cumulative[id + 1]! - shift.get(), 0, high.get(), frame) };
  });
}

/** Daily: the Sand light band behind the scrubbed bar. */
function Band({
  target,
  cumulative,
  point,
  zoom,
  frame,
}: {
  target: SpendTarget;
  cumulative: Float64Array;
  point: SharedValue<number>;
  zoom: Zoom;
  frame: Frame;
}) {
  const anchor = useAnchor(target, cumulative, point, zoom, frame);
  const place = useAnimatedStyle(() => ({ transform: [{ translateX: anchor.get().x - 15 }] }));
  return (
    <Animated.View
      pointerEvents="none"
      className="absolute left-0 rounded-lg bg-sand-light"
      style={[{ top: 40, width: 30, height: 110 }, place]}
    />
  );
}

/**
 * The tooltip, mounted only while a finger scrubs. Guide, dot and callout move on the UI thread
 * from `point`; only the callout's words wait for React.
 */
function Selection({
  screen,
  target,
  cumulative,
  point,
  zoom,
  frame,
  width,
  tokens,
  date,
  value,
}: {
  screen: Screen;
  target: SpendTarget;
  cumulative: Float64Array;
  point: SharedValue<number>;
  zoom: Zoom;
  frame: Frame;
  width: number;
  tokens: Tokens;
  date: string;
  value: string;
}) {
  const anchor = useAnchor(target, cumulative, point, zoom, frame);
  const daily = target.mode === 'daily';
  const guide = useAnimatedStyle(() => ({
    height: Math.max(0, anchor.get().y - GUIDE_TOP - (daily ? 1 : 0)),
    transform: [{ translateX: anchor.get().x - 0.75 }],
  }));
  const dot = useAnimatedStyle(() => ({
    transform: [{ translateX: anchor.get().x - 8.5 }, { translateY: anchor.get().y - 8.5 }],
  }));
  const handle = useAnimatedStyle(() => ({ transform: [{ translateX: anchor.get().x - 14 }] }));
  const callout = useAnimatedStyle(() => ({
    transform: [{ translateX: calloutLeft(anchor.get().x, width) }],
  }));
  return (
    <Animated.View
      pointerEvents="none"
      className="absolute inset-0"
    >
      <Animated.View
        className="absolute left-0 border-l-[1.5px] border-dashed border-foreground"
        style={[{ top: GUIDE_TOP }, guide]}
      />
      {daily ? null : (
        <>
          <Animated.View
            className="absolute left-0 top-0 h-[17px] w-[17px] items-center justify-center rounded-full bg-foreground"
            style={dot}
          >
            <View className="h-3.5 w-3.5 rounded-full border-[3px] border-card bg-foreground" />
          </Animated.View>
          <Animated.View
            className="absolute left-0 h-5 w-7 items-center justify-center rounded-full bg-primary"
            style={[{ top: 132 }, handle]}
          >
            <IconSymbol
              name="arrow-left-right"
              size={14}
              color={tokens.primaryForeground}
            />
          </Animated.View>
        </>
      )}
      <Animated.View
        accessibilityLiveRegion="polite"
        className="absolute left-0 top-0 h-[38px] w-[100px] items-center justify-center rounded-xl bg-primary"
        style={callout}
      >
        <Text
          className="text-[12px] leading-[15px] text-primary-foreground opacity-85"
          numberOfLines={1}
        >
          {date}
        </Text>
        <Text
          testID={tid(screen, 'chart', 'callout')}
          className="text-[14px] leading-[18px] font-display-bold text-primary-foreground"
          numberOfLines={1}
        >
          {value}
        </Text>
      </Animated.View>
    </Animated.View>
  );
}
