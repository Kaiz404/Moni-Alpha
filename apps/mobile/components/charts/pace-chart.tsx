import type { MinorAmount } from '@repo/types';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from 'react-native-gesture-handler';
import Animated, {
  useAnimatedProps,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import Svg, { Circle, Line, Path, Polyline } from 'react-native-svg';
import { scheduleOnRN } from 'react-native-worklets';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { Text } from '@/components/ui/text';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { formatMoney } from '@/lib/finance/format-money';
import { scrubStep } from '@/lib/haptics';
import { springs } from '@/lib/motion/tokens';
import { tid, type Screen } from '@/lib/test-ids';

const AnimatedPolyline = Animated.createAnimatedComponent(Polyline);
const AnimatedPath = Animated.createAnimatedComponent(Path);

const HEIGHT = 150;
const AXIS = 44;
const PLOT_LEFT = 54;
const RIGHT_INSET = 4;
const TOP_Y = 44;
const BASE_Y = 142;
const CALLOUT_W = 100;
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export type PaceChartProps = {
  screen: Screen;
  /** Spend so far: index 0 is before day 1, the last index is the last day drawn. */
  series: readonly MinorAmount[];
  daysInMonth: number;
  /** `YYYY-MM`, for the axis and callout dates. */
  month: string;
  budget: MinorAmount | null;
  currency: string;
  /** The last drawn day is today; past months end on their last day. */
  endsToday: boolean;
  /** Who is spending, for the screen reader: "Spent so far in October". */
  what: string;
  mode?: 'pace';
};

/** A round step so the top gridline reads cleanly: RM160, RM1,800. */
function niceTop(value: number): number {
  if (value <= 0) return 10000;
  const step = 10 ** Math.max(2, Math.floor(Math.log10(value)) - 1) * 4;
  return Math.ceil(value / step) * step;
}

function dayDate(month: string, day: number): string {
  const [year, number] = month.split('-').map(Number);
  const date = new Date(year, number - 1, day);
  const name = date.toLocaleString('en-US', { month: 'short' });
  return `${WEEKDAYS[date.getDay()]} ${day} ${name}`;
}

/**
 * The spent-vs-budget line from tokens.md Charts: Ink 3 line over a Sand
 * fill to today, even pace dashed to the budget, the budget as a gridline
 * with a Deep mint label and end dot, and one callout that follows a finger
 * snapping per day. The line draws in once on the `value` spring.
 */
export function PaceChart({
  screen,
  series,
  daysInMonth,
  month,
  budget,
  currency,
  endsToday,
  what,
}: PaceChartProps) {
  const tokens = useThemeTokens();
  const [width, setWidth] = useState(0);
  const lastDay = series.length - 1;
  const [picked, setPicked] = useState<number | null>(null);
  const selected = Math.min(picked ?? lastDay, lastDay);

  useFocusEffect(
    useCallback(() => {
      setPicked(null);
    }, []),
  );
  useEffect(() => setPicked(null), [month]);

  const spent = Number(series[lastDay] ?? 0);
  const over = budget !== null && spent > budget;
  const top = budget === null ? niceTop(spent) : over ? niceTop(spent) : Number(budget);
  const right = Math.max(width - RIGHT_INSET, PLOT_LEFT + 1);
  const x = useCallback(
    (day: number) => PLOT_LEFT + (day * (right - PLOT_LEFT)) / daysInMonth,
    [right, daysInMonth],
  );
  const y = useCallback((value: number) => BASE_Y - (value / top) * (BASE_Y - TOP_Y), [top]);

  const geometry = useMemo(() => {
    const points = series.map((value, day) => [x(day), y(Number(value))] as const);
    let length = 0;
    for (let i = 1; i < points.length; i += 1)
      length += Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
    return {
      line: points.map(([px, py]) => `${px},${py}`).join(' '),
      area: `M${PLOT_LEFT},${BASE_Y} ${points.map(([px, py]) => `L${px},${py}`).join(' ')} L${x(lastDay)},${BASE_Y} Z`,
      length: Math.max(length, 1),
    };
  }, [series, x, y, lastDay]);

  const drawn = useSharedValue(0);
  useEffect(() => {
    drawn.set(withSpring(1, springs.value));
  }, [drawn]);
  const lineProps = useAnimatedProps(() => ({
    strokeDashoffset: geometry.length * (1 - Math.min(1, drawn.get())),
  }));
  const areaProps = useAnimatedProps(() => ({ fillOpacity: 0.8 * Math.min(1, drawn.get()) }));

  const step = (right - PLOT_LEFT) / daysInMonth;
  const shown = useRef(selected);
  shown.current = selected;
  const pick = useCallback((day: number) => {
    if (day === shown.current) return;
    shown.current = day;
    scrubStep();
    setPicked(day);
  }, []);
  const scrub = useMemo(() => {
    const toDay = (px: number) => {
      'worklet';
      return Math.min(lastDay, Math.max(1, Math.round((px - PLOT_LEFT) / step)));
    };
    const pan = Gesture.Pan()
      .activeOffsetX([-6, 6])
      .failOffsetY([-12, 12])
      .onBegin((event) => {
        scheduleOnRN(pick, toDay(event.x));
      })
      .onChange((event) => {
        scheduleOnRN(pick, toDay(event.x));
      });
    const tap = Gesture.Tap().onEnd((event) => {
      scheduleOnRN(pick, toDay(event.x));
    });
    return Gesture.Race(pan, tap);
  }, [lastDay, pick, step]);

  const budgetY = budget === null ? TOP_Y : y(Number(budget));
  const selectedX = x(selected);
  const selectedY = y(Number(series[selected] ?? 0));
  const calloutLeft = Math.max(AXIS, Math.min(width - CALLOUT_W, selectedX - CALLOUT_W / 2));
  const whole = (value: number) => formatMoney(value, currency, { whole: true });
  const atEnd = selected === lastDay;
  const calloutDate = atEnd && endsToday ? 'By today' : dayDate(month, selected);
  const monthName = dayDate(month, 1).split(' ')[2];

  const label = `${what}, ${formatMoney(spent, currency)} ${endsToday ? 'by today' : 'in all'}${
    budget === null
      ? '. No budget set.'
      : ` against the ${whole(Number(budget))} budget. The dashed line is an even pace.`
  }`;

  return (
    <View
      testID={tid(screen, 'pace-chart')}
      className="gap-2"
    >
      <View
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={label}
        accessibilityValue={{
          text: `${calloutDate}, ${formatMoney(Number(series[selected] ?? 0), currency)} so far`,
        }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(event) =>
          pick(
            Math.min(
              lastDay,
              Math.max(1, selected + (event.nativeEvent.actionName === 'increment' ? 1 : -1)),
            ),
          )
        }
        style={{ height: HEIGHT }}
        onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      >
        {width > 0 ? (
          <GestureHandlerRootView style={{ flex: 1 }}>
            <GestureDetector gesture={scrub}>
              <View style={{ width, height: HEIGHT }}>
                <Svg
                  width={width}
                  height={HEIGHT}
                  style={{ position: 'absolute' }}
                >
                  <Line
                    x1={PLOT_LEFT}
                    y1={TOP_Y}
                    x2={right}
                    y2={TOP_Y}
                    stroke={tokens.hairline}
                    strokeWidth={1.5}
                  />
                  <Line
                    x1={PLOT_LEFT}
                    y1={(TOP_Y + BASE_Y) / 2}
                    x2={right}
                    y2={(TOP_Y + BASE_Y) / 2}
                    stroke={tokens.sandLight}
                    strokeWidth={1.5}
                    strokeDasharray="3 5"
                  />
                  <Line
                    x1={PLOT_LEFT}
                    y1={BASE_Y}
                    x2={right}
                    y2={BASE_Y}
                    stroke={tokens.hairline}
                    strokeWidth={1.5}
                  />
                  {over ? (
                    <Line
                      x1={PLOT_LEFT}
                      y1={budgetY}
                      x2={right}
                      y2={budgetY}
                      stroke={tokens.hairline}
                      strokeWidth={1.5}
                    />
                  ) : null}
                  <AnimatedPath
                    d={geometry.area}
                    fill={tokens.sand}
                    animatedProps={areaProps}
                  />
                  {budget !== null ? (
                    <Line
                      x1={PLOT_LEFT}
                      y1={BASE_Y}
                      x2={right}
                      y2={budgetY}
                      stroke={tokens.inactive}
                      strokeWidth={1.5}
                      strokeDasharray="5 5"
                    />
                  ) : null}
                  <AnimatedPolyline
                    points={geometry.line}
                    fill="none"
                    stroke={tokens.foreground}
                    strokeWidth={3}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    strokeDasharray={`${geometry.length} ${geometry.length}`}
                    animatedProps={lineProps}
                  />
                  {budget !== null ? (
                    <Circle
                      cx={right}
                      cy={budgetY}
                      r={5}
                      fill={tokens.deepMint}
                      stroke={tokens.card}
                      strokeWidth={2}
                    />
                  ) : null}
                  <Line
                    x1={selectedX}
                    y1={38}
                    x2={selectedX}
                    y2={Math.max(38, selectedY - 7)}
                    stroke={tokens.foreground}
                    strokeWidth={1.5}
                    strokeDasharray="4 3"
                  />
                  <Circle
                    cx={selectedX}
                    cy={selectedY}
                    r={5.5}
                    fill={tokens.foreground}
                    stroke={tokens.card}
                    strokeWidth={3}
                  />
                </Svg>
                <AxisLabel
                  top={36}
                  text={budget !== null && !over ? whole(Number(budget)) : whole(top)}
                  budget={budget !== null && !over}
                />
                <AxisLabel
                  top={85}
                  text={whole(top / 2)}
                />
                <AxisLabel
                  top={134}
                  text={whole(0)}
                />
                {over ? (
                  <AxisLabel
                    top={budgetY - 8}
                    text={whole(Number(budget))}
                    budget
                  />
                ) : null}
                {budget !== null ? (
                  <Text
                    className="absolute right-0 text-[12px] leading-4 font-display-bold text-deep-mint"
                    style={{ top: budgetY - 22 }}
                  >
                    Budget
                  </Text>
                ) : null}
                <View
                  pointerEvents="none"
                  className="absolute items-center justify-center rounded-full bg-primary"
                  style={{ left: selectedX - 14, top: 132, width: 28, height: 20 }}
                >
                  <IconSymbol
                    name="arrow-left-right"
                    size={14}
                    color={tokens.primaryForeground}
                  />
                </View>
                <View
                  pointerEvents="none"
                  className="absolute top-0 items-center justify-center rounded-[12px] bg-primary"
                  style={{ left: calloutLeft, width: CALLOUT_W, height: 38 }}
                >
                  <Text className="text-[12px] leading-[15px] text-primary-foreground opacity-90">
                    {calloutDate}
                  </Text>
                  <Text
                    className="text-[14px] leading-[18px] font-display-bold text-primary-foreground"
                    style={{ fontVariant: ['tabular-nums'] }}
                  >
                    {formatMoney(Number(series[selected] ?? 0), currency)}
                  </Text>
                </View>
              </View>
            </GestureDetector>
          </GestureHandlerRootView>
        ) : null}
      </View>
      <View
        className="h-4"
        importantForAccessibility="no-hide-descendants"
      >
        <Text
          className="absolute text-[12px] leading-4 text-muted"
          style={{ left: PLOT_LEFT - 4 }}
        >
          {`1 ${monthName}`}
        </Text>
        {endsToday && width > 0 ? (
          <Text
            className="absolute w-[60px] text-center text-[12px] leading-4 font-display-bold text-foreground"
            style={{ left: x(lastDay) - 30 }}
          >
            Today
          </Text>
        ) : null}
        <Text className="absolute right-0 text-[12px] leading-4 text-muted">
          {`${daysInMonth} ${monthName}`}
        </Text>
      </View>
      <View
        className="flex-row items-center justify-between"
        importantForAccessibility="no-hide-descendants"
      >
        <View className="flex-row items-center gap-2.5">
          <View className="flex-row items-center gap-1">
            <View className="h-[3px] w-3.5 rounded-full bg-primary" />
            <Text className="text-[12px] leading-4 text-muted">Spent</Text>
          </View>
          {budget !== null ? (
            <View className="flex-row items-center gap-1">
              <View className="w-4 flex-row justify-between">
                {[0, 1, 2].map((dash) => (
                  <View
                    key={dash}
                    className="h-[1.5px] w-1 bg-inactive"
                  />
                ))}
              </View>
              <Text className="text-[12px] leading-4 text-muted">Even pace</Text>
            </View>
          ) : null}
        </View>
        <View className="flex-row items-center gap-1">
          <IconSymbol
            name="gesture-tap"
            size={16}
            color={tokens.muted}
          />
          <Text className="text-[12px] leading-4 text-muted">Tap or drag</Text>
        </View>
      </View>
    </View>
  );
}

function AxisLabel({ top, text, budget = false }: { top: number; text: string; budget?: boolean }) {
  return (
    <Text
      className={`absolute left-0 text-right text-[12px] leading-4 ${budget ? 'font-display-bold text-deep-mint' : 'text-muted'}`}
      style={{ top, width: AXIS, fontVariant: ['tabular-nums'] }}
      numberOfLines={1}
    >
      {text}
    </Text>
  );
}
