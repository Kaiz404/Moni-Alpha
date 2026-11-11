import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import {
  Gesture,
  GestureDetector,
} from 'react-native-gesture-handler';
import Animated, {
  FadeIn,
  LinearTransition,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Line, Path, Polyline } from 'react-native-svg';
import { useUniwind } from 'uniwind';
import { scheduleOnRN } from 'react-native-worklets';

import {
  AXIS_LABEL_OVERHANG,
  AXIS_WIDTH,
  PLOT_HEIGHT,
  calloutLeft,
} from '@/components/charts/pace-geometry';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Segmented } from '@/components/ui/segmented';
import { Text } from '@/components/ui/text';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { dayLabel } from '@/lib/dates/day-label';
import {
  balanceHistory,
} from '@/lib/finance/balance-history';
import { CHART_RANGES, type ChartRange } from '@/lib/finance/chart-range';
import { formatMoney } from '@/lib/finance/format-money';
import type {
  FinanceTransaction,
  FinanceWallet,
} from '@/lib/finance/types';
import { chartStep } from '@/lib/haptics';
import { springs } from '@/lib/motion/tokens';
import { tid } from '@/lib/test-ids';
import { compactWalletNames } from '@/lib/wallets/compact-name';

import {
  dayReading,
  netWorthGeometry,
  walletLineStyles,
  type NetWorthGeometry,
  type NetWorthView,
  type WalletLineStyle,
} from './net-worth-geometry';

const DEFAULT_WIDTH = 314;
const REDUCED_FADE = { duration: 180 };
const GUIDE_TOP = 38;
/** The selection appears for the last part of the draw, once the line has nearly reached it. */
const SELECTION_FADE_FROM = 0.6;
const VIEWS: readonly { value: NetWorthView; label: string }[] = [
  { value: 'total', label: 'Total' },
  { value: 'by-wallet', label: 'By wallet' },
];

/** The card and everything under it slide together when the key opens below the chart. */
export const netWorthLayout = LinearTransition.springify()
  .stiffness(springs.sheet.stiffness)
  .damping(springs.sheet.damping);

type Tokens = ReturnType<typeof useThemeTokens>;

function xAt(
  index: number,
  left: number,
  step: number,
  right: number,
): number {
  'worklet';
  return step > 0 ? left + index * step : right;
}

/**
 * The Wallets card: net worth now, its closing balance over a chosen range, as one line or one per
 * wallet. The number stays on the live balance, and the callout and key read the scrubbed day.
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
  const [picked, setPicked] = useState<number | null>(null);
  const view = wallets.length > 1 ? chosenView : 'total';

  const history = useMemo(
    () =>
      balanceHistory({
        now,
        range,
        wallets: wallets.map((wallet) => ({
          id: wallet.id,
          balanceMinor: Number(balances[wallet.id] ?? 0),
          createdAt: wallet.createdAt,
        })),
        transactions,
      }),
    [now, range, wallets, balances, transactions],
  );
  const names = useMemo(() => compactWalletNames(wallets), [wallets]);
  const lineStyles = useMemo(
    () => walletLineStyles(wallets, dark),
    [wallets, dark],
  );
  const geometry = useMemo(
    () => netWorthGeometry({ history, view, names, width, currency }),
    [history, view, names, width, currency],
  );

  const last = history.days.length - 1;
  const selected = Math.min(picked ?? last, last);
  const index = useSharedValue(last);
  useEffect(() => {
    if (picked === null) index.set(last);
  }, [picked, last, index]);

  const reveal = useSharedValue(reduceMotion ? 1 : 0);
  useEffect(() => {
    reveal.set(
      reduceMotion
        ? withTiming(1, REDUCED_FADE)
        : withSpring(1, springs.value),
    );
  }, [range, view, reduceMotion, reveal]);
  // Cleared in the press handler, so the new line never shows whole for a frame before it draws.
  const redraw = () => reveal.set(0);

  const lastPick = useRef<number | null>(null);
  const { left, step } = geometry;
  const onPick = (next: number) => {
    setPicked(next);
    if (next !== lastPick.current) chartStep(history.days.length);
    lastPick.current = next;
  };
  const gesture = useMemo(() => {
    const pick = (x: number) => {
      'worklet';
      const next =
        step > 0
          ? Math.max(0, Math.min(last, Math.round((x - left) / step)))
          : 0;
      if (next === index.get()) return;
      index.set(next);
      scheduleOnRN(onPick, next);
    };
    const tap = Gesture.Tap().onEnd((event) => pick(event.x));
    const pan = Gesture.Pan()
      .activeOffsetX([-6, 6])
      .failOffsetY([-12, 12])
      .onUpdate((event) => pick(event.x));
    return Gesture.Exclusive(pan, tap);
    // onPick only closes over the day count, listed here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [left, step, last, history.days.length, index]);

  const nudge = (next: number) => {
    if (next < 0 || next > last) return;
    index.set(next);
    onPick(next);
  };

  const clip = useAnimatedStyle(() => {
    const hidden = reduceMotion
      ? 0
      : (1 - Math.min(reveal.get(), 1)) * (width - left);
    return {
      opacity: reduceMotion ? reveal.get() : 1,
      transform: [{ translateX: -hidden }],
    };
  });
  const unclip = useAnimatedStyle(() => {
    const hidden = reduceMotion
      ? 0
      : (1 - Math.min(reveal.get(), 1)) * (width - left);
    return { transform: [{ translateX: hidden }] };
  });
  const labelsFade = useAnimatedStyle(() => ({
    opacity: Math.min(reveal.get(), 1),
  }));
  const selectionFade = useAnimatedStyle(() => ({
    opacity: Math.max(
      0,
      (reveal.get() - SELECTION_FADE_FROM) /
        (1 - SELECTION_FADE_FROM),
    ),
  }));

  const hasWallets = wallets.length > 0;
  const day = history.days[selected]!;

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
            onChange={(next) => {
              redraw();
              setView(next);
            }}
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
              onLayout={(event) =>
                setWidth(Math.round(event.nativeEvent.layout.width))
              }
            >
              <Grid
                geometry={geometry}
                width={width}
                solid={tokens.hairline}
                dashed={tokens.sandLight}
              />
              <Animated.View
                pointerEvents="none"
                className="absolute overflow-hidden"
                style={[
                  { left: 0, top: 0, width, height: PLOT_HEIGHT },
                  clip,
                ]}
              >
                <Animated.View style={unclip}>
                  <Marks
                    geometry={geometry}
                    view={view}
                    lineStyles={lineStyles}
                    width={width}
                    ink={tokens.foreground}
                    fill={tokens.sand}
                  />
                </Animated.View>
              </Animated.View>
              <Animated.View
                pointerEvents="none"
                className="absolute inset-0"
                style={labelsFade}
              >
                <YAxis geometry={geometry} />
              </Animated.View>
              <Animated.View
                pointerEvents="none"
                className="absolute inset-0"
                style={selectionFade}
              >
                <Scrub
                  geometry={geometry}
                  view={view}
                  lineStyles={lineStyles}
                  index={index}
                  width={width}
                  tokens={tokens}
                  date={dayLabel(day, now)}
                  value={formatMoney(
                    history.total[selected]!,
                    currency,
                  )}
                />
              </Animated.View>
              <GestureDetector gesture={gesture}>
                <View
                  testID={tid('wallet', 'chart', 'plot')}
                  accessible
                  accessibilityRole="adjustable"
                  accessibilityLabel={geometry.accessibilityLabel}
                  accessibilityValue={{
                    text: dayReading(
                      history,
                      selected,
                      view,
                      names,
                      currency,
                      now,
                    ),
                  }}
                  accessibilityActions={[
                    { name: 'increment' },
                    { name: 'decrement' },
                  ]}
                  onAccessibilityAction={(event) =>
                    nudge(
                      selected +
                        (event.nativeEvent.actionName === 'increment'
                          ? 1
                          : -1),
                    )
                  }
                  className="absolute inset-0"
                />
              </GestureDetector>
            </View>
            <Animated.View style={labelsFade}>
              <Ticks geometry={geometry} />
            </Animated.View>
          </View>
          <Segmented
            screen="wallet"
            name="chart"
            size="compact"
            options={CHART_RANGES}
            value={range}
            accessibilityLabel="Time range"
            onChange={(next) => {
              redraw();
              lastPick.current = null;
              setPicked(null);
              setRange(next);
            }}
          />
          {view === 'by-wallet' ? (
            <Animated.View
              entering={FadeIn.duration(180)}
              testID={tid('wallet', 'chart', 'key')}
              className="flex-row flex-wrap gap-y-1 pt-0.5"
            >
              {wallets.map((wallet) => {
                const value =
                  history.byWallet[wallet.id]?.[selected] ?? null;
                return (
                  <KeyEntry
                    key={wallet.id}
                    id={wallet.id}
                    name={names[wallet.id]!}
                    lineStyle={lineStyles[wallet.id]!}
                    value={
                      value === null
                        ? 'Not yet'
                        : formatMoney(value, currency)
                    }
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
  geometry: { left, right, top, baseline },
  width,
  solid,
  dashed,
}: {
  geometry: NetWorthGeometry;
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
        y1={(top + baseline) / 2}
        x2={right}
        y2={(top + baseline) / 2}
        stroke={dashed}
        strokeWidth={1.5}
        strokeDasharray="3 5"
      />
      <Line
        x1={left}
        y1={baseline}
        x2={right}
        y2={baseline}
        stroke={solid}
        strokeWidth={1.5}
      />
    </Svg>
  );
});

/** Memoised: a scrub re-renders the card many times a second and must not touch up to 365 points per line. */
const Marks = memo(function Marks({
  geometry: { area, lines },
  view,
  lineStyles,
  width,
  ink,
  fill,
}: {
  geometry: NetWorthGeometry;
  view: NetWorthView;
  lineStyles: Record<string, WalletLineStyle>;
  width: number;
  ink: string;
  fill: string;
}) {
  return (
    <Svg
      width={width}
      height={PLOT_HEIGHT}
    >
      {area ? (
        <Path
          d={area}
          fill={fill}
          opacity={0.8}
        />
      ) : null}
      {lines.map((line) => (
        <Polyline
          key={line.id}
          points={line.points}
          fill="none"
          stroke={view === 'total' ? ink : lineStyles[line.id]!.color}
          strokeWidth={view === 'total' ? 3 : 2.5}
          strokeDasharray={
            view === 'total' ? undefined : lineStyles[line.id]!.dash
          }
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      ))}
    </Svg>
  );
});

const YAxis = memo(function YAxis({
  geometry: { axis },
}: {
  geometry: NetWorthGeometry;
}) {
  return axis.map((label) => (
    <Text
      key={label.y}
      variant="smallest"
      numberOfLines={1}
      adjustsFontSizeToFit
      className="absolute text-right text-muted"
      style={{
        left: -AXIS_LABEL_OVERHANG,
        width: AXIS_WIDTH + AXIS_LABEL_OVERHANG,
        top: label.y - 8,
      }}
    >
      {label.text}
    </Text>
  ));
});

const Ticks = memo(function Ticks({
  geometry: { ticks },
}: {
  geometry: NetWorthGeometry;
}) {
  return (
    <View style={{ height: 16 }}>
      {ticks.map((tick) => (
        <Text
          key={tick.align}
          variant="smallest"
          numberOfLines={1}
          className={`absolute ${tick.align === 'center' ? 'w-[64px] text-center' : ''} ${tick.today ? 'font-display-bold text-foreground' : 'text-muted'}`}
          style={
            tick.align === 'start'
              ? { left: AXIS_WIDTH + 6 }
              : tick.align === 'end'
                ? { right: 0 }
                : { left: tick.x - 32 }
          }
        >
          {tick.text}
        </Text>
      ))}
    </View>
  );
});

/** Guide and dots move on the UI thread from `index`. Only the callout's words wait for React. */
function Scrub({
  geometry,
  view,
  lineStyles,
  index,
  width,
  tokens,
  date,
  value,
}: {
  geometry: NetWorthGeometry;
  view: NetWorthView;
  lineStyles: Record<string, WalletLineStyle>;
  index: SharedValue<number>;
  width: number;
  tokens: Tokens;
  date: string;
  value: string;
}) {
  const { left, step, right, baseline, lines } = geometry;
  const guide = useAnimatedStyle(() => ({
    transform: [{ translateX: xAt(index.get(), left, step, right) }],
  }));
  const callout = useAnimatedStyle(() => ({
    transform: [
      {
        translateX: calloutLeft(
          xAt(index.get(), left, step, right),
          width,
        ),
      },
    ],
  }));
  return (
    <>
      <Animated.View
        className="absolute left-0 top-0 h-full w-px"
        style={guide}
      >
        <View
          className="absolute border-l-[1.5px] border-dashed border-foreground"
          style={{
            left: -0.75,
            top: GUIDE_TOP,
            height: baseline - GUIDE_TOP,
          }}
        />
        <View
          className="absolute h-5 w-7 items-center justify-center rounded-full bg-primary"
          style={{ left: -14, top: baseline - 10 }}
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
          ys={line.ys}
          index={index}
          left={left}
          step={step}
          right={right}
          color={
            view === 'total'
              ? tokens.foreground
              : lineStyles[line.id]!.color
          }
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
  ys,
  index,
  left,
  step,
  right,
  color,
  size,
}: {
  ys: readonly (number | null)[];
  index: SharedValue<number>;
  left: number;
  step: number;
  right: number;
  color: string;
  size: number;
}) {
  const place = useAnimatedStyle(() => {
    const y = ys[index.get()] ?? null;
    return {
      opacity: y === null ? 0 : 1,
      transform: [
        {
          translateX: xAt(index.get(), left, step, right) - size / 2,
        },
        { translateY: (y ?? 0) - size / 2 },
      ],
    };
  });
  return (
    <Animated.View
      className="absolute left-0 top-0 rounded-full border-2 border-card"
      style={[
        { width: size, height: size, backgroundColor: color },
        place,
      ]}
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
