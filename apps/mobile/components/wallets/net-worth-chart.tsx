import { memo, useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  FadeIn,
  FadeOut,
  LayoutAnimationConfig,
  LinearTransition,
  useAnimatedProps,
  useAnimatedStyle,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Line, Path } from 'react-native-svg';
import { useUniwind } from 'uniwind';
import { scheduleOnRN } from 'react-native-worklets';

import { PLOT_HEIGHT, calloutLeft } from '@/components/charts/pace-geometry';
import {
  areaPath,
  frameFor,
  linePath,
  uAt,
  useZoom,
  xAt,
  yAt,
  type Frame,
  type Zoom,
} from '@/components/charts/zoom';
import { YLabels, ZoomTicks } from '@/components/charts/zoom-axes';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Segmented } from '@/components/ui/segmented';
import { Text } from '@/components/ui/text';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { dayLabel } from '@/lib/dates/day-label';
import { toLocalDateInput } from '@/lib/dates/local-date-input';
import { balanceIndex } from '@/lib/finance/balance-history';
import { CHART_RANGES, dateAt, type ChartRange } from '@/lib/finance/chart-range';
import { formatMoney } from '@/lib/finance/format-money';
import type { FinanceTransaction, FinanceWallet } from '@/lib/finance/types';
import { chartStep } from '@/lib/haptics';
import { springs } from '@/lib/motion/tokens';
import { tid } from '@/lib/test-ids';
import { compactWalletNames } from '@/lib/wallets/compact-name';

import {
  NET_WORTH_BASE,
  NET_WORTH_TOP,
  dayReading,
  netWorthTarget,
  walletLineStyles,
  type NetWorthView,
  type WalletLineStyle,
} from './net-worth-geometry';

const DEFAULT_WIDTH = 314;
const GUIDE_TOP = 38;
/** The selection appears for the last part of the draw-in, once the line has nearly reached it. */
const SELECTION_FADE_FROM = 0.6;
const VIEW_IN = FadeIn.duration(180);
const VIEW_OUT = FadeOut.duration(180);
const VIEWS: readonly { value: NetWorthView; label: string }[] = [
  { value: 'total', label: 'Total' },
  { value: 'by-wallet', label: 'By wallet' },
];

const AnimatedPath = Animated.createAnimatedComponent(Path);

/** The card and everything under it slide together when the key opens below the chart. */
export const netWorthLayout = LinearTransition.springify()
  .stiffness(springs.sheet.stiffness)
  .damping(springs.sheet.damping);

type Tokens = ReturnType<typeof useThemeTokens>;

/**
 * The Wallets card: net worth now, its closing balance over a chosen range, as one line or one per
 * wallet. The balances are indexed once; a range change zooms the axes on one spring. The number
 * stays on the live balance, and the callout and key read the scrubbed day.
 */
export function NetWorthChart({
  now,
  currency,
  totalMinor,
  wallets,
  balances,
  transactions,
}: {
  now: Date;
  currency: string;
  totalMinor: number;
  /** Main-currency wallets, in list order. */
  wallets: readonly FinanceWallet[];
  balances: Readonly<Record<string, number>>;
  transactions: readonly FinanceTransaction[];
}) {
  const tokens = useThemeTokens();
  const dark = useUniwind().theme === 'dark';
  const reduceMotion = useReducedMotion();
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const [range, setRange] = useState<ChartRange>('30d');
  const [chosenView, setView] = useState<NetWorthView>('total');
  const view = wallets.length > 1 ? chosenView : 'total';

  const index = useMemo(
    () =>
      balanceIndex({
        now,
        wallets: wallets.map((wallet) => ({
          id: wallet.id,
          balanceMinor: Number(balances[wallet.id] ?? 0),
          createdAt: wallet.createdAt,
        })),
        transactions,
      }),
    [now, wallets, balances, transactions],
  );
  const names = useMemo(() => compactWalletNames(wallets), [wallets]);
  const lineStyles = useMemo(() => walletLineStyles(wallets, dark), [wallets, dark]);
  const target = useMemo(
    () => netWorthTarget({ index, now, range, view, names, currency }),
    [index, now, range, view, names, currency],
  );
  const zoom = useZoom(
    { from: target.from, to: target.to, low: target.low, high: target.high, shift: 0 },
    reduceMotion,
  );
  const frame = useMemo(() => frameFor(width, NET_WORTH_TOP, NET_WORTH_BASE), [width]);

  const { from: first, to: last } = target;
  const [pick, setPick] = useState<{ range: ChartRange; day: number } | null>(null);
  const selected = pick?.range === range ? Math.max(first, Math.min(last, pick.day)) : last;
  const day = useSharedValue(selected);
  useEffect(() => {
    day.set(selected);
  }, [selected, day]);

  const onPick = (next: number) => {
    setPick({ range, day: next });
    chartStep(target.count);
  };
  const { from, to, reveal, fade } = zoom;
  const gesture = useMemo(() => {
    const pick = (x: number) => {
      'worklet';
      const next = Math.max(first, Math.min(last, Math.round(uAt(x, from.get(), to.get(), frame))));
      if (next === day.get()) return;
      day.set(next);
      scheduleOnRN(onPick, next);
    };
    const tap = Gesture.Tap().onEnd((event) => pick(event.x));
    const pan = Gesture.Pan()
      .activeOffsetX([-6, 6])
      .failOffsetY([-12, 12])
      .onUpdate((event) => pick(event.x));
    return Gesture.Exclusive(pan, tap);
    // onPick only closes over the range and the day count, both listed through the target.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [first, last, from, to, frame, day, range]);

  const nudge = (next: number) => {
    if (next < first || next > last) return;
    day.set(next);
    onPick(next);
  };

  const selectionFade = useAnimatedStyle(() => ({
    opacity:
      fade.get() *
      Math.max(0, (reveal.get() - SELECTION_FADE_FROM) / (1 - SELECTION_FADE_FROM)),
  }));

  const ids = useMemo(
    () => (view === 'total' ? ['total'] : Object.keys(names)),
    [view, names],
  );
  const series = useMemo(
    () => ids.map((id) => (id === 'total' ? index.total : index.byWallet[id]!)),
    [ids, index],
  );
  const hasWallets = wallets.length > 0;

  return (
    <Animated.View
      layout={netWorthLayout}
      className="gap-2 rounded-card bg-card px-[18px] py-3.5"
    >
      <View className="min-h-9 flex-row items-center justify-between">
        <Text
          variant="caps"
          className="text-muted"
        >
          Net worth
        </Text>
        {wallets.length > 1 ? (
          <Segmented
            screen="wallet"
            name="chart"
            size="compact"
            segmentWidth={70}
            accessibilityLabel="Net worth chart"
            options={VIEWS}
            value={view}
            onChange={setView}
          />
        ) : null}
      </View>
      <Text
        testID={tid('wallet', 'list', 'net-worth')}
        className="text-[32px] leading-9 font-display-bold text-foreground"
        style={{ fontVariant: ['tabular-nums'] }}
      >
        {formatMoney(totalMinor, currency)}
      </Text>
      {hasWallets ? (
        <>
          <View className="gap-1.5">
            <View
              style={{ height: PLOT_HEIGHT }}
              onLayout={(event) => setWidth(Math.round(event.nativeEvent.layout.width))}
            >
              <Grid
                frame={frame}
                width={width}
                solid={tokens.hairline}
                dashed={tokens.sandLight}
              />
              <LayoutAnimationConfig skipEntering>
                <Animated.View
                  key={view}
                  entering={VIEW_IN}
                  exiting={VIEW_OUT}
                  pointerEvents="none"
                  className="absolute inset-0"
                >
                  <Marks
                    ids={ids}
                    series={series}
                    view={view}
                    lineStyles={lineStyles}
                    zoom={zoom}
                    frame={frame}
                    width={width}
                    ink={tokens.foreground}
                    fill={tokens.sand}
                  />
                </Animated.View>
              </LayoutAnimationConfig>
              <YLabels
                rows={target.axis}
                fit
              />
              <Animated.View
                pointerEvents="none"
                className="absolute inset-0"
                style={selectionFade}
              >
                <Scrub
                  ids={ids}
                  series={series}
                  view={view}
                  lineStyles={lineStyles}
                  day={day}
                  zoom={zoom}
                  frame={frame}
                  width={width}
                  tokens={tokens}
                  date={dayLabel(toLocalDateInput(dateAt(index.firstDay, selected)), now)}
                  value={formatMoney(index.total[selected]!, currency)}
                />
              </Animated.View>
              <GestureDetector gesture={gesture}>
                <View
                  testID={tid('wallet', 'chart', 'plot')}
                  accessible
                  accessibilityRole="adjustable"
                  accessibilityLabel={target.accessibilityLabel}
                  accessibilityValue={{
                    text: dayReading(index, selected, view, names, currency, now),
                  }}
                  accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
                  onAccessibilityAction={(event) =>
                    nudge(selected + (event.nativeEvent.actionName === 'increment' ? 1 : -1))
                  }
                  className="absolute inset-0"
                />
              </GestureDetector>
            </View>
            <ZoomTicks
              ticks={target.ticks}
              todayU={last}
              zoom={zoom}
              frame={frame}
              width={width}
            />
          </View>
          <Segmented
            screen="wallet"
            name="chart"
            size="compact"
            options={CHART_RANGES}
            value={range}
            accessibilityLabel="Time range"
            onChange={setRange}
          />
          {view === 'by-wallet' ? (
            <Animated.View
              entering={FadeIn.duration(180)}
              testID={tid('wallet', 'chart', 'key')}
              className="flex-row flex-wrap gap-y-1 pt-0.5"
            >
              {wallets.map((wallet) => {
                const value = index.byWallet[wallet.id]?.[selected] ?? NaN;
                return (
                  <KeyEntry
                    key={wallet.id}
                    id={wallet.id}
                    name={names[wallet.id]!}
                    lineStyle={lineStyles[wallet.id]!}
                    value={Number.isNaN(value) ? 'Not yet' : formatMoney(value, currency)}
                  />
                );
              })}
            </Animated.View>
          ) : null}
        </>
      ) : null}
    </Animated.View>
  );
}

const Grid = memo(function Grid({
  frame: { left, right, top, base },
  width,
  solid,
  dashed,
}: {
  frame: Frame;
  width: number;
  solid: string;
  dashed: string;
}) {
  return (
    <Svg
      width={width}
      height={PLOT_HEIGHT}
      style={{ position: 'absolute' }}
    >
      <Line
        x1={left}
        y1={top}
        x2={right}
        y2={top}
        stroke={solid}
        strokeWidth={1.5}
      />
      <Line
        x1={left}
        y1={(top + base) / 2}
        x2={right}
        y2={(top + base) / 2}
        stroke={dashed}
        strokeWidth={1.5}
        strokeDasharray="3 5"
      />
      <Line
        x1={left}
        y1={base}
        x2={right}
        y2={base}
        stroke={solid}
        strokeWidth={1.5}
      />
    </Svg>
  );
});

/** Memoised: a scrub re-renders the card many times a second, and the lines redraw on the UI thread anyway. */
const Marks = memo(function Marks({
  ids,
  series,
  view,
  lineStyles,
  zoom,
  frame,
  width,
  ink,
  fill,
}: {
  ids: readonly string[];
  series: readonly Float64Array[];
  view: NetWorthView;
  lineStyles: Record<string, WalletLineStyle>;
  zoom: Zoom;
  frame: Frame;
  width: number;
  ink: string;
  fill: string;
}) {
  return (
    <Svg
      width={width}
      height={PLOT_HEIGHT}
    >
      {ids.map((id, line) => (
        <BalanceLine
          key={id}
          values={series[line]!}
          area={view === 'total' ? fill : null}
          color={view === 'total' ? ink : lineStyles[id]!.color}
          strokeWidth={view === 'total' ? 3 : 2.5}
          dash={view === 'total' ? undefined : lineStyles[id]!.dash}
          zoom={zoom}
          frame={frame}
        />
      ))}
    </Svg>
  );
});

function BalanceLine({
  values,
  area,
  color,
  strokeWidth,
  dash,
  zoom: { from, to, low, high, reveal, fade },
  frame,
}: {
  values: Float64Array;
  /** Total only: the soft fill under the line. */
  area: string | null;
  color: string;
  strokeWidth: number;
  dash: string | undefined;
  zoom: Zoom;
  frame: Frame;
}) {
  const line = useDerivedValue(() =>
    linePath(values, from.get(), to.get(), low.get(), high.get(), 0, frame, reveal.get()),
  );
  const lineProps = useAnimatedProps(() => ({ d: line.get().d, opacity: fade.get() }));
  const areaProps = useAnimatedProps(() => ({
    d: areaPath(line.get(), frame),
    opacity: 0.8 * fade.get(),
  }));
  return (
    <>
      {area ? (
        <AnimatedPath
          fill={area}
          animatedProps={areaProps}
        />
      ) : null}
      <AnimatedPath
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeDasharray={dash}
        strokeLinejoin="round"
        strokeLinecap="round"
        animatedProps={lineProps}
      />
    </>
  );
}

/** Guide and dots move on the UI thread from `day` and the live viewport. Only the callout's words wait for React. */
function Scrub({
  ids,
  series,
  view,
  lineStyles,
  day,
  zoom,
  frame,
  width,
  tokens,
  date,
  value,
}: {
  ids: readonly string[];
  series: readonly Float64Array[];
  view: NetWorthView;
  lineStyles: Record<string, WalletLineStyle>;
  day: SharedValue<number>;
  zoom: Zoom;
  frame: Frame;
  width: number;
  tokens: Tokens;
  date: string;
  value: string;
}) {
  const { from, to } = zoom;
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
      {ids.map((id, line) => (
        <Dot
          key={id}
          values={series[line]!}
          day={day}
          zoom={zoom}
          frame={frame}
          color={view === 'total' ? tokens.foreground : lineStyles[id]!.color}
          size={view === 'total' ? 14 : 11}
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
  day: SharedValue<number>;
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

function KeyEntry({
  id,
  name,
  lineStyle,
  value,
}: {
  id: string;
  name: string;
  lineStyle: WalletLineStyle;
  value: string;
}) {
  return (
    <View
      testID={tid('wallet', 'chart', 'key', id)}
      className="w-1/2 flex-row items-center gap-1.5 pr-3"
    >
      <Svg
        width={14}
        height={4}
      >
        <Line
          x1={1}
          y1={2}
          x2={13}
          y2={2}
          stroke={lineStyle.color}
          strokeWidth={2.5}
          strokeDasharray={lineStyle.dash}
          strokeLinecap="round"
        />
      </Svg>
      <Text
        variant="smallest"
        className="min-w-0 flex-1 text-ink-2"
        numberOfLines={1}
      >
        {name}
      </Text>
      <Text
        variant="smallest"
        className="text-foreground"
        style={{ fontVariant: ['tabular-nums'] }}
        numberOfLines={1}
      >
        {value}
      </Text>
    </View>
  );
}
