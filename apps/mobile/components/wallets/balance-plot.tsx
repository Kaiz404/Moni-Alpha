import { memo, useMemo, useState } from 'react';
import { View } from 'react-native';
import { Canvas, DashPathEffect, Path } from '@shopify/react-native-skia';
import { GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  FadeIn,
  FadeOut,
  LayoutAnimationConfig,
  useAnimatedStyle,
  useDerivedValue,
  useReducedMotion,
  type DerivedValue,
  type SharedValue,
} from 'react-native-reanimated';

import { PLOT_HEIGHT, calloutLeft } from '@/components/charts/pace-geometry';
import {
  areaPath,
  frameFor,
  linePath,
  useZoom,
  xAt,
  yAt,
  type Frame,
  type Zoom,
} from '@/components/charts/zoom';
import { readerStep, Tip, useChartScrub } from '@/components/charts/scrub';
import { YGrid, YLabels, ZoomTicks } from '@/components/charts/zoom-axes';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Text } from '@/components/ui/text';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import type { BalanceIndex } from '@/lib/finance/balance-history';
import { tid } from '@/lib/test-ids';

import { NET_WORTH_BASE, NET_WORTH_TOP, type NetWorthTarget } from './net-worth-geometry';
import { addDays, dayLabel, formatMoney } from '@repo/core';
import { deviceCalendar } from '@/lib/dates/device-calendar';

const DEFAULT_WIDTH = 314;
const GUIDE_TOP = 38;
const LINES_IN = FadeIn.duration(180);
const LINES_OUT = FadeOut.duration(180);

/** One balance line: `area` is the soft fill under it, or null for none. */
export type BalanceLineSpec = {
  id: string;
  values: Float64Array;
  color: string;
  strokeWidth: number;
  dash: number[] | undefined;
  area: string | null;
  dotSize: number;
};

/**
 * The balance plot under the net worth card and a wallet's chart: closing balances on the shared
 * zoom, so a new `target` glides the axes on one spring, and a finger shows the tooltip.
 */
export function BalancePlot({
  index,
  target,
  lines,
  linesKey,
  pickKey,
  currency,
  now,
  reading,
}: {
  index: BalanceIndex;
  target: NetWorthTarget;
  lines: readonly BalanceLineSpec[];
  /** A new key cross-fades the lines instead of zooming them. */
  linesKey: string;
  /** A new key drops the picked day, so the reading returns to the window's last day. */
  pickKey: string;
  currency: string;
  now: Date;
  /** What a screen reader hears for a day. */
  reading: (day: number) => string;
}) {
  const tokens = useThemeTokens();
  const reduceMotion = useReducedMotion();
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const zoom = useZoom(
    { from: target.from, to: target.to, low: target.low, high: target.high, shift: 0 },
    reduceMotion,
  );
  const frame = useMemo(() => frameFor(width, NET_WORTH_TOP, NET_WORTH_BASE), [width]);

  // A finger's pick shows the tooltip until it lifts; a screen reader's only moves the spoken value.
  const { to: last, points } = target;
  const [pick, setPick] = useState<{ key: string; day: number; by: 'finger' | 'reader' } | null>(null);
  const current = pick?.key === pickKey ? pick : null;
  const selected = current?.day ?? last;
  const held = current?.by === 'finger';
  const { gesture, point, shown } = useChartScrub({
    testID: tid('wallet', 'chart'),
    points,
    zoom,
    frame,
    onPoint: (day) => setPick(day === null ? null : { key: pickKey, day, by: 'finger' }),
  });
  const nudge = (by: 1 | -1) => {
    const next = readerStep(points, selected, by);
    if (next !== null) setPick({ key: pickKey, day: next, by: 'reader' });
  };

  return (
    <View className="gap-1.5">
      <View
        style={{ height: PLOT_HEIGHT }}
        onLayout={(event) => setWidth(Math.round(event.nativeEvent.layout.width))}
      >
        <YGrid
          rows={target.axis}
          zoom={zoom}
          frame={frame}
          width={width}
          solid={tokens.hairline}
          dashed={tokens.sandLight}
        />
        <LayoutAnimationConfig skipEntering>
          <Animated.View
            key={linesKey}
            entering={LINES_IN}
            exiting={LINES_OUT}
            pointerEvents="none"
            className="absolute inset-0"
          >
            <Marks
              lines={lines}
              zoom={zoom}
              frame={frame}
              width={width}
            />
          </Animated.View>
        </LayoutAnimationConfig>
        <YLabels
          rows={target.axis}
          zoom={zoom}
          frame={frame}
          fit
        />
        {held ? (
          <Tip shown={shown}>
            <Scrub
              lines={lines}
              point={point}
              days={points.ids}
              zoom={zoom}
              frame={frame}
              width={width}
              tokens={tokens}
              date={dayLabel(addDays(index.firstDay, selected), deviceCalendar.dayKey(now))}
              value={formatMoney(index.total[selected]!, currency)}
            />
          </Tip>
        ) : null}
        <GestureDetector gesture={gesture}>
          <View
            testID={tid('wallet', 'chart', 'plot')}
            accessible
            accessibilityRole="adjustable"
            accessibilityLabel={target.accessibilityLabel}
            accessibilityValue={{ text: reading(selected) }}
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
        todayU={index.days - 1}
        zoom={zoom}
        frame={frame}
        width={width}
      />
    </View>
  );
}

type Tokens = ReturnType<typeof useThemeTokens>;

/** Memoised: a scrub re-renders the card many times a second, and the lines redraw on the UI thread anyway. */
const Marks = memo(function Marks({
  lines,
  zoom,
  frame,
  width,
}: {
  lines: readonly BalanceLineSpec[];
  zoom: Zoom;
  frame: Frame;
  width: number;
}) {
  return (
    <Canvas style={{ width, height: PLOT_HEIGHT }}>
      {lines.map((line) => (
        <BalanceLine
          key={line.id}
          line={line}
          zoom={zoom}
          frame={frame}
        />
      ))}
    </Canvas>
  );
});

function BalanceLine({
  line: { values, area, color, strokeWidth, dash },
  zoom: { from, to, low, high, reveal, fade },
  frame,
}: {
  line: BalanceLineSpec;
  zoom: Zoom;
  frame: Frame;
}) {
  const line = useDerivedValue(() =>
    linePath(values, from.get(), to.get(), low.get(), high.get(), 0, frame, reveal.get()),
  );
  const lineD = useDerivedValue(() => line.get().d);
  const lineOpacity = useDerivedValue(() => fade.get());
  const areaD = useDerivedValue(() => (area ? areaPath(line.get(), frame) : ''));
  const areaOpacity = useDerivedValue(() => 0.8 * fade.get());
  return (
    <>
      {area ? (
        <Path
          path={areaD}
          color={area}
          opacity={areaOpacity}
        />
      ) : null}
      <Path
        path={lineD}
        style="stroke"
        color={color}
        strokeWidth={strokeWidth}
        strokeJoin="round"
        strokeCap="round"
        opacity={lineOpacity}
      >
        {dash ? <DashPathEffect intervals={dash} /> : null}
      </Path>
    </>
  );
}

/**
 * The tooltip, mounted only while a finger scrubs. Guide and dots move on the UI thread from
 * `point` and the live viewport; only the callout's words wait for React.
 */
function Scrub({
  lines,
  point,
  days,
  zoom,
  frame,
  width,
  tokens,
  date,
  value,
}: {
  lines: readonly BalanceLineSpec[];
  point: SharedValue<number>;
  /** The day each scrub point reads. */
  days: Float64Array;
  zoom: Zoom;
  frame: Frame;
  width: number;
  tokens: Tokens;
  date: string;
  value: string;
}) {
  const { from, to } = zoom;
  const day = useDerivedValue(() => days[Math.min(point.get(), days.length - 1)]!);
  const guide = useAnimatedStyle(() => ({
    transform: [{ translateX: xAt(day.get(), from.get(), to.get(), frame) }],
  }));
  const callout = useAnimatedStyle(() => ({
    transform: [{ translateX: calloutLeft(xAt(day.get(), from.get(), to.get(), frame), width) }],
  }));
  return (
    <>
      <Animated.View
        className="absolute left-0 top-0 h-full w-px"
        style={guide}
      >
        <View
          className="absolute border-l-[1.5px] border-dashed border-foreground"
          style={{ left: -0.75, top: GUIDE_TOP, height: frame.base - GUIDE_TOP }}
        />
        <View
          className="absolute h-5 w-7 items-center justify-center rounded-full bg-primary"
          style={{ left: -14, top: frame.base - 10 }}
        >
          <IconSymbol
            name="arrow-left-right"
            size={14}
            color={tokens.primaryForeground}
          />
        </View>
      </Animated.View>
      {lines.map((line) => (
        <Dot
          key={line.id}
          values={line.values}
          day={day}
          zoom={zoom}
          frame={frame}
          color={line.color}
          size={line.dotSize}
        />
      ))}
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
          testID={tid('wallet', 'chart', 'callout')}
          className="text-[14px] leading-[18px] font-display-bold text-primary-foreground"
          style={{ fontVariant: ['tabular-nums'] }}
          numberOfLines={1}
        >
          {value}
        </Text>
      </Animated.View>
    </>
  );
}

function Dot({
  values,
  day,
  zoom: { from, to, low, high },
  frame,
  color,
  size,
}: {
  values: Float64Array;
  day: DerivedValue<number>;
  zoom: Zoom;
  frame: Frame;
  color: string;
  size: number;
}) {
  const place = useAnimatedStyle(() => {
    const value = values[day.get()]!;
    const missing = value !== value;
    return {
      opacity: missing ? 0 : 1,
      transform: [
        { translateX: xAt(day.get(), from.get(), to.get(), frame) - size / 2 },
        { translateY: (missing ? 0 : yAt(value, low.get(), high.get(), frame)) - size / 2 },
      ],
    };
  });
  return (
    <Animated.View
      className="absolute left-0 top-0 rounded-full border-2 border-card"
      style={[{ width: size, height: size, backgroundColor: color }, place]}
    />
  );
}
