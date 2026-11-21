import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSpring,
} from 'react-native-reanimated';
import Svg, { Circle, Line, Path, Polyline, Rect } from 'react-native-svg';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { Text } from '@/components/ui/text';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { springs } from '@repo/design';
import { tid, type Screen } from '@/lib/test-ids';

import {
  AXIS_LABEL_OVERHANG,
  AXIS_WIDTH,
  PLOT_HEIGHT,
  calloutLeft,
  paceGeometry,
  polylineLength,
  type DaySeries,
  type PaceChartMode,
  type PaceGeometry,
} from './pace-geometry';
import { scrubPoints, Tip, useChartScrub } from './scrub';
import type { Frame } from './zoom';

export type { DaySeries, PaceChartMode } from './pace-geometry';

type Tokens = ReturnType<typeof useThemeTokens>;

const AnimatedPolyline = Animated.createAnimatedComponent(Polyline);
const AnimatedRect = Animated.createAnimatedComponent(Rect);

const DEFAULT_WIDTH = 314;
const BAR_STAGGER_MS = 14;
const PIXELS: Frame = { left: 0, right: 1, top: 0, base: 0 };

export type PaceChartProps = {
  screen: Screen;
  /** `pace` spent against budget, `daily` one bar a day. */
  mode: PaceChartMode;
  series: DaySeries;
  /** Minor units for the month. */
  budget: number | null;
  currency: string;
  /** Daily: today's dashed segment, in minor units. */
  safePerDay?: number | null;
  /** False for a past month, whose series runs to its last day. */
  endsToday?: boolean;
  /** Leads the screen-reader sentence: "Transport spending so far in October". */
  what?: string;
};

/**
 * The spent-vs-budget line and daily bars from tokens.md
 * Charts, with the day-snapping scrub and the one callout while a finger is down. Draws in once per
 * mode on first open; never on return.
 */
export function PaceChart({
  screen,
  mode,
  series,
  budget,
  currency,
  safePerDay = null,
  endsToday = true,
  what,
}: PaceChartProps) {
  const geometryOf = useCallback(
    (width: number) =>
      paceGeometry({ mode, series, budget, currency, safePerDay, width, endsToday, what }),
    [mode, series, budget, currency, safePerDay, endsToday, what],
  );
  return (
    <Plot
      screen={screen}
      mode={mode}
      geometryOf={geometryOf}
    />
  );
}

function Plot({
  screen,
  mode,
  geometryOf,
}: {
  screen: Screen;
  mode: PaceChartMode;
  geometryOf: (width: number) => PaceGeometry;
}) {
  const tokens = useThemeTokens();
  const reduceMotion = useReducedMotion();
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const geometry = useMemo(() => geometryOf(width), [geometryOf, width]);
  const last = geometry.points.length - 1;

  const drawn = useRef(new Set<PaceChartMode>());
  const animate = !reduceMotion && !drawn.current.has(mode);
  useEffect(() => {
    drawn.current.add(mode);
  }, [mode]);

  // A finger's pick shows the callout until it lifts; a screen reader's only moves the spoken value.
  const [pick, setPick] = useState<{ mode: PaceChartMode; index: number; by: 'finger' | 'reader' } | null>(null);
  const current = pick?.mode === mode ? pick : null;
  const selected = Math.min(current?.index ?? last, last);
  const held = current?.by === 'finger';
  const points = useMemo(
    () => scrubPoints(geometry.points.map((point, index) => [point.x, index, true] as const)),
    [geometry.points],
  );
  // The pace chart never zooms, so the scrub's viewport is the plot's own pixels.
  const from = useSharedValue(0);
  const to = useSharedValue(1);
  const { gesture, shown } = useChartScrub({
    testID: tid(screen, 'chart'),
    points,
    zoom: { from, to },
    frame: PIXELS,
    onPoint: (index) => setPick(index === null ? null : { mode, index, by: 'finger' }),
  });
  const nudge = (by: 1 | -1) => {
    const index = selected + by;
    if (index >= 0 && index <= last) setPick({ mode, index, by: 'reader' });
  };

  const point = geometry.points[selected];

  return (
    <View
      testID={tid(screen, 'pace-chart')}
      className="gap-1.5"
    >
      <View
        style={{ height: PLOT_HEIGHT }}
        onLayout={(event) =>
          setWidth(Math.round(event.nativeEvent.layout.width))
        }
      >
        {mode === 'daily' && point && held ? (
          <Tip shown={shown}>
            <View
              className="absolute rounded-lg bg-sand-light"
              style={{ left: point.x - 15, top: 40, width: 30, height: 110 }}
            />
          </Tip>
        ) : null}
        <Svg
          width={width}
          height={PLOT_HEIGHT}
          style={{ position: 'absolute' }}
        >
          {mode === 'daily' ? (
            <DailyBars
              geometry={geometry}
              animate={animate}
              tokens={tokens}
            />
          ) : (
            <LineMarks
              geometry={geometry}
              animate={animate}
              tokens={tokens}
            />
          )}
        </Svg>
        {geometry.labels.map((label) => (
          <Text
            key={`${label.text}:${label.y}`}
            testID={
              label.tone === 'ink'
                ? tid(screen, 'chart', 'even-pace')
                : label.tone === 'mint'
                  ? tid(screen, 'chart', 'budget')
                  : undefined
            }
            variant="smallest"
            numberOfLines={1}
            className={`absolute text-right ${label.tone === 'meta' ? 'text-muted' : label.tone === 'ink' ? 'font-display-bold text-foreground' : 'font-display-bold text-deep-mint'}`}
            style={{
              left: -AXIS_LABEL_OVERHANG,
              width: AXIS_WIDTH + AXIS_LABEL_OVERHANG,
              top: label.y - 8,
            }}
          >
            {label.text}
          </Text>
        ))}
        {mode === 'pace' && geometry.budgetY !== null ? (
          <Text
            variant="smallest"
            className="absolute font-display-bold text-deep-mint"
            style={{ right: 0, top: geometry.budgetY - 20 }}
          >
            Budget
          </Text>
        ) : null}
        {point && held ? (
          <Tip shown={shown}>
            <Selection
              screen={screen}
              geometry={geometry}
              index={selected}
              tokens={tokens}
            />
          </Tip>
        ) : null}
        <GestureDetector gesture={gesture}>
          <View
            testID={tid(screen, 'chart', 'plot')}
            accessible
            accessibilityRole="adjustable"
            accessibilityLabel={geometry.accessibilityLabel}
            accessibilityValue={{ text: point?.accessibilityLabel }}
            accessibilityActions={[
              { name: 'increment' },
              { name: 'decrement' },
            ]}
            onAccessibilityAction={(event) =>
              nudge(event.nativeEvent.actionName === 'increment' ? 1 : -1)
            }
            className="absolute inset-0"
          />
        </GestureDetector>
      </View>
      <Ticks geometry={geometry} />
    </View>
  );
}

function Selection({
  screen,
  geometry: { points, mode: kind, width: plotWidth },
  index,
  tokens,
}: {
  screen: Screen;
  geometry: PaceGeometry;
  index: number;
  tokens: Tokens;
}) {
  const at = points[index]!;
  const guideTop = 38;
  return (
    <>
      <View
        className="absolute border-l-[1.5px] border-dashed border-foreground"
        style={{
          left: at.x - 0.75,
          top: guideTop,
          height: Math.max(0, at.y - guideTop - (kind === 'daily' ? 1 : 0)),
        }}
      />
      {kind === 'daily' ? null : (
        <>
          <View
            className="absolute h-[17px] w-[17px] items-center justify-center rounded-full bg-foreground"
            style={{ left: at.x - 8.5, top: at.y - 8.5 }}
          >
            <View className="h-3.5 w-3.5 rounded-full border-[3px] border-card bg-foreground" />
          </View>
          <View
            className="absolute h-5 w-7 items-center justify-center rounded-full bg-primary"
            style={{ left: at.x - 14, top: 132 }}
          >
            <IconSymbol
              name="arrow-left-right"
              size={14}
              color={tokens.primaryForeground}
            />
          </View>
        </>
      )}
      <View
        accessibilityLiveRegion="polite"
        className="absolute h-[38px] w-[100px] items-center justify-center rounded-xl bg-primary"
        style={{ left: calloutLeft(at.x, plotWidth), top: 0 }}
      >
        <Text
          className="text-[12px] leading-[15px] text-primary-foreground opacity-85"
          numberOfLines={1}
        >
          {at.date}
        </Text>
        <Text
          testID={tid(screen, 'chart', 'callout')}
          className="text-[14px] leading-[18px] font-display-bold text-primary-foreground"
          numberOfLines={1}
        >
          {at.value}
        </Text>
      </View>
    </>
  );
}

function LineMarks({
  geometry: g,
  animate: drawIn,
  tokens,
}: {
  geometry: PaceGeometry;
  animate: boolean;
  tokens: Tokens;
}) {
  const right = g.width - 4;
  const lastPoint = g.line[g.line.length - 1];
  const fill =
    g.line.length > 1 && lastPoint
      ? `M${g.line[0]!.x},${g.baseline} ${g.line.map((p) => `L${p.x},${p.y}`).join(' ')} L${lastPoint.x},${g.baseline} Z`
      : null;
  return (
    <>
      <Line
        x1={54}
        y1={g.top}
        x2={right}
        y2={g.top}
        stroke={tokens.hairline}
        strokeWidth={1.5}
      />
      <Line
        x1={54}
        y1={(g.top + g.baseline) / 2}
        x2={right}
        y2={(g.top + g.baseline) / 2}
        stroke={tokens.sandLight}
        strokeWidth={1.5}
        strokeDasharray="3 5"
      />
      <Line
        x1={54}
        y1={g.baseline}
        x2={right}
        y2={g.baseline}
        stroke={tokens.hairline}
        strokeWidth={1.5}
      />
      {g.budgetY !== null && g.budgetY !== g.top ? (
        <Line
          x1={54}
          y1={g.budgetY}
          x2={right}
          y2={g.budgetY}
          stroke={tokens.deepMint}
          strokeWidth={1.5}
        />
      ) : null}
      {fill ? (
        <Path
          d={fill}
          fill={tokens.sand}
          opacity={0.8}
        />
      ) : null}
      {g.evenPace ? (
        <Line
          {...g.evenPace}
          stroke={tokens.inactive}
          strokeWidth={1.5}
          strokeDasharray="5 5"
        />
      ) : null}
      {g.line.length > 1 ? (
        <DrawnLine
          points={g.line}
          animate={drawIn}
          color={tokens.foreground}
        />
      ) : null}
      {g.budgetY !== null ? (
        <Circle
          cx={right}
          cy={g.budgetY}
          r={5}
          fill={tokens.deepMint}
          stroke={tokens.card}
          strokeWidth={2}
        />
      ) : null}
    </>
  );
}

function DrawnLine({
  points,
  animate: drawIn,
  color,
}: {
  points: { x: number; y: number }[];
  animate: boolean;
  color: string;
}) {
  const length = polylineLength(points);
  const offset = useSharedValue(drawIn ? length : 0);
  useEffect(() => {
    if (drawIn) offset.set(withSpring(0, springs.value));
    // Draw in once on mount; later data changes redraw in place.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const props = useAnimatedProps(() => ({
    strokeDashoffset: offset.get(),
  }));
  return (
    <AnimatedPolyline
      points={points.map((p) => `${p.x},${p.y}`).join(' ')}
      fill="none"
      stroke={color}
      strokeWidth={3}
      strokeLinejoin="round"
      strokeLinecap="round"
      strokeDasharray={[length + 1, length + 1]}
      animatedProps={props}
    />
  );
}

function DailyBars({
  geometry: g,
  animate: grow,
  tokens,
}: {
  geometry: PaceGeometry;
  animate: boolean;
  tokens: Tokens;
}) {
  return (
    <>
      <Line
        x1={50}
        y1={g.top}
        x2={g.width}
        y2={g.top}
        stroke={tokens.sandLight}
        strokeWidth={1.5}
        strokeDasharray="3 5"
      />
      <Line
        x1={50}
        y1={g.baseline}
        x2={g.width}
        y2={g.baseline}
        stroke={tokens.hairline}
        strokeWidth={1.5}
      />
      {g.bars.map((bar, index) => (
        <Bar
          key={index}
          x={bar.x}
          barWidth={g.barWidth}
          top={bar.top}
          base={g.baseline - 0.7}
          even={g.budgetY}
          delay={index * BAR_STAGGER_MS}
          animate={grow}
          ink={tokens.foreground}
          coral={tokens.coral}
        />
      ))}
      {g.safe ? (
        <Rect
          x={g.safe.x - g.barWidth / 2}
          y={g.safe.top}
          width={g.barWidth}
          height={g.safe.height}
          rx={6}
          fill={tokens.card}
          stroke={tokens.foreground}
          strokeWidth={1.2}
          strokeDasharray="2 2"
        />
      ) : null}
      {g.budgetY !== null ? (
        <Line
          x1={50}
          y1={g.budgetY}
          x2={g.width}
          y2={g.budgetY}
          stroke={tokens.foreground}
          strokeWidth={1.5}
          strokeDasharray="4 4"
        />
      ) : null}
    </>
  );
}

function Bar({
  x,
  barWidth,
  top,
  base,
  even,
  delay,
  animate: grow,
  ink: inkColor,
  coral,
}: {
  x: number;
  barWidth: number;
  top: number;
  base: number;
  even: number | null;
  delay: number;
  animate: boolean;
  ink: string;
  coral: string;
}) {
  const progress = useSharedValue(grow ? 0 : 1);
  useEffect(() => {
    if (grow)
      progress.set(withDelay(delay, withSpring(1, springs.value)));
    // Grow once on mount, staggered.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const ink = useAnimatedProps(() => {
    const height = (base - top) * progress.get();
    return { y: base - height, height };
  });
  const over = useAnimatedProps(() => {
    const current = base - (base - top) * progress.get();
    const height = even === null ? 0 : Math.max(0, even - current);
    return { y: current, height };
  });
  return (
    <>
      <AnimatedRect
        x={x - barWidth / 2}
        width={barWidth}
        rx={Math.min(6, barWidth / 2)}
        fill={inkColor}
        animatedProps={ink}
      />
      {even !== null && top < even ? (
        <AnimatedRect
          x={x - barWidth / 2}
          width={barWidth}
          rx={Math.min(6, barWidth / 2)}
          fill={coral}
          animatedProps={over}
        />
      ) : null}
    </>
  );
}

function Ticks({ geometry: g }: { geometry: PaceGeometry }) {
  const today = g.ticks.find((tick) => tick.today);
  const first = g.ticks[0];
  const end = g.ticks[g.ticks.length - 1];
  const visible = g.ticks.filter(
    (tick) =>
      tick.today || !today || Math.abs(tick.x - today.x) >= 52,
  );
  return (
    <View style={{ height: 16 }}>
      {visible.map((tick) => {
        const edge =
          g.mode === 'daily' || tick.today
            ? null
            : tick === first
              ? 'start'
              : tick === end
                ? 'end'
                : null;
        return (
          <Text
            key={tick.text}
            variant="smallest"
            numberOfLines={1}
            className={`absolute ${edge ? '' : 'w-[60px] text-center'} ${tick.today ? 'font-display-bold text-foreground' : 'text-muted'}`}
            style={
              edge === 'start'
                ? { left: AXIS_WIDTH + 6 }
                : edge === 'end'
                  ? { right: 0 }
                  : {
                      left: Math.max(
                        AXIS_WIDTH - 4,
                        Math.min(g.width - 60, tick.x - 30),
                      ),
                    }
            }
          >
            {tick.text}
          </Text>
        );
      })}
    </View>
  );
}
