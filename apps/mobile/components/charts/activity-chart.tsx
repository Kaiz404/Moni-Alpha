import type { CurrencyCode } from '@repo/types';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSpring,
} from 'react-native-reanimated';
import Svg, { Line, Path, Polyline } from 'react-native-svg';
import { scheduleOnRN } from 'react-native-worklets';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { Press } from '@/components/ui/press';
import { Segmented } from '@/components/ui/segmented';
import { Text } from '@/components/ui/text';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { dayLabel } from '@/lib/dates/day-label';
import type { BalanceMonth, SpendingMonth } from '@/lib/finance/activity-series';
import { formatMoney } from '@/lib/finance/format-money';
import { scrubStep } from '@/lib/haptics';
import { springs } from '@/lib/motion/tokens';
import { tid, type Screen } from '@/lib/test-ids';

export type ActivityChartMode = 'spending' | 'balance';

type ActivityChartProps = {
  mode: ActivityChartMode;
  onModeChange: (mode: ActivityChartMode) => void;
  spending: SpendingMonth;
  balance: BalanceMonth;
  currency: CurrencyCode;
  /** Local `YYYY-MM-DD` the list is narrowed to; the callout sits on today without one. */
  selectedDay: string | null;
  onSelectDay: (day: string | null) => void;
  now: Date;
};

const PLOT_H = 150;
const TOP = 44;
const BASE = 141.25;
const AXIS = 50;
const CALLOUT_W = 100;
const MODES = [
  { value: 'spending', label: 'Spending' },
  { value: 'balance', label: 'Balance' },
] as const;

let barsGrownThisSession = false;
let lineDrawnThisSession = false;

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function niceCeil(value: number): number {
  const step = 10 ** Math.max(0, Math.floor(Math.log10(Math.max(value, 1))) - 1);
  return Math.ceil(value / step) * step;
}

function niceStep(span: number): number {
  const magnitude = 10 ** Math.floor(Math.log10(Math.max(span, 1)));
  return [1, 2, 2.5, 5, 10].map((f) => f * magnitude).find((s) => s >= span) ?? magnitude * 10;
}

export function ActivityChart(props: ActivityChartProps) {
  const { mode, onModeChange, spending, balance, currency, now } = props;
  const [width, setWidth] = useState(314);
  const month = MONTHS[now.getMonth()];
  const short = (offset: number) =>
    MONTHS[(now.getMonth() + 12 + offset) % 12].slice(0, 3);
  const spend = mode === 'spending';
  const latest = balance.days.at(-1)?.balanceMinor ?? 0;
  const diff = spending.spentMinor - spending.lastMonthByNowMinor;
  const sub = spend
    ? [
        spending.inMinor > 0
          ? `+${formatMoney(spending.inMinor, currency)} in`
          : null,
        spending.lastMonthByNowMinor > 0
          ? diff === 0
            ? `Same as ${short(-1)} by now`
            : `${formatMoney(Math.abs(diff), currency)} ${diff < 0 ? 'less' : 'more'} than ${short(-1)} by now`
          : null,
      ]
        .filter(Boolean)
        .join(' · ')
    : `${currency} wallets, closing balance each day`;

  return (
    <View
      className="gap-3 rounded-card bg-card px-[18px] py-3.5"
      accessibilityLabel={spend ? `Daily spending in ${month}` : `Balance in ${month}`}
    >
      <View className="flex-row items-center justify-between gap-3">
        <Text variant="caps" className="flex-shrink text-muted" numberOfLines={1}>
          {spend ? `Spent in ${month}` : 'Balance'}
        </Text>
        <View className="w-[176px]">
          <Segmented
            screen="activity"
            name="chart-mode"
            options={MODES}
            value={mode}
            onChange={onModeChange}
            accessibilityLabel="Chart type"
          />
        </View>
      </View>
      <View>
        <Text
          variant="screenTitle"
          className="text-foreground"
          style={{ fontVariant: ['tabular-nums'] }}
        >
          {formatMoney(spend ? spending.spentMinor : latest, currency)}
        </Text>
        {sub ? (
          <Text variant="meta" className="text-ink-2" numberOfLines={1}>
            {sub}
          </Text>
        ) : null}
      </View>
      <View
        className="overflow-hidden"
        onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      >
        {spend ? (
          <SpendingPlot {...props} width={width} month={month} />
        ) : (
          <BalancePlot {...props} width={width} month={month} />
        )}
      </View>
      <Legend spend={spend} paced={spending.evenPaceMinor !== null} />
    </View>
  );
}

export function Legend({ spend, paced }: { spend: boolean; paced: boolean }) {
  const tokens = useThemeTokens();
  return (
    <View className="flex-row items-center justify-between gap-2">
      <View className="flex-shrink flex-row flex-wrap items-center gap-x-3 gap-y-1">
        {spend && paced ? (
          <>
            <View className="flex-row items-center gap-1.5">
              <View className="h-2.5 w-2.5 rounded-[3px] bg-coral" />
              <Text variant="smallest" className="text-muted">Over even pace</Text>
            </View>
            <View className="flex-row items-center gap-1.5">
              <View className="h-2.5 w-2.5 rounded-[3px] border border-dashed border-foreground" />
              <Text variant="smallest" className="text-muted">Safe to spend a day</Text>
            </View>
          </>
        ) : spend ? null : (
          <View className="flex-row items-center gap-1.5">
            <View className="h-[3px] w-3.5 rounded-full bg-foreground" />
            <Text variant="smallest" className="text-muted">Balance</Text>
          </View>
        )}
      </View>
      <View className="flex-row items-center gap-1">
        <IconSymbol name="gesture-tap" size={14} color={tokens.muted} />
        <Text variant="smallest" className="text-muted">
          {spend ? 'Tap a bar' : 'Tap or drag'}
        </Text>
      </View>
    </View>
  );
}

type PlotProps = ActivityChartProps & { width: number; month: string };

function XLabel({
  x,
  width,
  label,
  strong,
}: {
  x: number;
  width: number;
  label: string;
  strong?: boolean;
}) {
  const left = Math.min(width - 60, Math.max(AXIS - 10, x - 30));
  return (
    <Text
      variant="smallest"
      className={`absolute w-[60px] text-center ${strong ? 'font-display-semibold text-foreground' : 'text-muted'}`}
      style={{ left, top: PLOT_H + 4 }}
      numberOfLines={1}
    >
      {label}
    </Text>
  );
}

function Callout({
  x,
  width,
  date,
  value,
}: {
  x: number;
  width: number;
  date: string;
  value: string;
}) {
  return (
    <View
      pointerEvents="none"
      className="absolute top-0 h-[38px] items-center justify-center rounded-[12px] bg-primary"
      style={{
        width: CALLOUT_W,
        left: Math.max(0, Math.min(width - CALLOUT_W, x - CALLOUT_W / 2)),
      }}
    >
      <Text variant="smallest" className="text-primary-foreground">
        {date}
      </Text>
      <Text
        className="text-[14px] leading-[18px] font-display-bold text-primary-foreground"
        style={{ fontVariant: ['tabular-nums'] }}
      >
        {value}
      </Text>
    </View>
  );
}

function AxisLabel({ y, label, strong }: { y: number; label: string; strong?: boolean }) {
  return (
    <Text
      variant="smallest"
      className={`absolute left-0 w-[44px] text-right ${strong ? 'font-display-bold text-foreground' : 'text-muted'}`}
      style={{ top: y - 8, fontVariant: ['tabular-nums'] }}
      numberOfLines={1}
      adjustsFontSizeToFit
    >
      {label}
    </Text>
  );
}

function SpendingPlot({ spending, currency, selectedDay, onSelectDay, width, month, now }: PlotProps) {
  const tokens = useThemeTokens();
  const { days, evenPaceMinor, safeToSpendMinor } = spending;
  const today = days.at(-1);
  const safe = safeToSpendMinor ?? 0;
  const top = niceCeil(
    Math.max(1000, evenPaceMinor ?? 0, ...days.map((d) => d.spentMinor), (today?.spentMinor ?? 0) + safe),
  );
  const y = (minor: number) => BASE - (minor / top) * (BASE - TOP);
  const step = (width - AXIS) / (days.length + 1.5);
  const barW = Math.min(12, step * 0.7);
  const barX = (index: number) => AXIS + step * 0.25 + index * step;
  const selected = days.find((d) => d.key === selectedDay) ?? today;
  const selectedIndex = selected ? days.indexOf(selected) : -1;
  const paceY = evenPaceMinor === null ? null : y(evenPaceMinor);
  const underPace = evenPaceMinor === null ? 0 : days.filter((d) => d.spentMinor <= evenPaceMinor).length;
  const reduceMotion = useReducedMotion();
  const animate = !barsGrownThisSession && !reduceMotion;
  useEffect(() => {
    barsGrownThisSession = true;
  }, []);

  const guideTop = selected
    ? y(selected.spentMinor) - (selected === today && safe > 0 ? (safe / top) * (BASE - TOP) + 3.5 : 2)
    : BASE;
  const label = [
    `Daily spending, 1 to ${days.length} ${month}.`,
    evenPaceMinor === null
      ? null
      : `${underPace} of ${days.length} days stayed at or under the even pace of ${formatMoney(evenPaceMinor, currency, { whole: true })}.`,
    today
      ? `Today ${formatMoney(today.spentMinor, currency)}${safeToSpendMinor === null ? '.' : `; safe to spend a day is ${formatMoney(safeToSpendMinor, currency, { whole: true })}.`}`
      : null,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <View style={{ height: PLOT_H + 22 }} accessibilityLabel={label}>
      {today ? (
        <View
          className="absolute rounded-[9px] bg-sand-light"
          style={{ left: barX(days.length - 1) - 4, width: barW + 8, top: TOP - 4, height: BASE - TOP + 4 }}
        />
      ) : null}
      <Svg width={width} height={PLOT_H} style={{ position: 'absolute' }}>
        <Line x1={AXIS} y1={TOP} x2={width} y2={TOP} stroke={tokens.sandLight} strokeWidth={1.5} strokeDasharray="3 5" />
        <Line x1={AXIS} y1={BASE} x2={width} y2={BASE} stroke={tokens.hairline} strokeWidth={1.5} />
        {selected ? (
          <Line
            x1={barX(selectedIndex) + barW / 2}
            y1={38}
            x2={barX(selectedIndex) + barW / 2}
            y2={Math.max(38, guideTop)}
            stroke={tokens.foreground}
            strokeWidth={1.5}
            strokeDasharray="3 3"
          />
        ) : null}
      </Svg>
      {days.map((day, index) => (
        <Bar
          key={day.key}
          index={index}
          x={barX(index)}
          width={barW}
          barTop={y(day.spentMinor)}
          paceY={paceY}
          safeHeight={day === today && safe > 0 ? (safe / top) * (BASE - TOP) : 0}
          spent={day.spentMinor > 0}
          animate={animate}
        />
      ))}
      {paceY === null ? null : (
        <Svg width={width} height={PLOT_H} style={{ position: 'absolute' }} pointerEvents="none">
          <Line x1={AXIS} y1={paceY} x2={width} y2={paceY} stroke={tokens.foreground} strokeWidth={1.5} strokeDasharray="4 4" />
        </Svg>
      )}
      <AxisLabel y={TOP} label={formatMoney(top, currency, { whole: true })} />
      {evenPaceMinor === null || paceY === null ? null : (
        <AxisLabel y={paceY} label={formatMoney(evenPaceMinor, currency, { whole: true })} strong />
      )}
      <AxisLabel y={BASE} label={formatMoney(0, currency, { whole: true })} />
      <XLabel width={width} x={barX(0) + barW / 2} label={`1 ${month.slice(0, 3)}`} />
      {today ? <XLabel width={width} x={barX(days.length - 1) + barW / 2} label="Today" strong /> : null}
      {selected ? (
        <Callout
          x={barX(selectedIndex) + barW / 2}
          width={width}
          date={dayLabel(selected.key, now)}
          value={formatMoney(selected.spentMinor, currency)}
        />
      ) : null}
      {days.map((day, index) => (
        <Press
          key={day.key}
          testID={tid('activity', 'chart', 'day', day.key)}
          accessibilityLabel={`${dayLabel(day.key, now)}, ${formatMoney(day.spentMinor, currency)} spent`}
          accessibilityState={{ selected: day.key === selectedDay }}
          pressedScale={1}
          pressedClassName="bg-transparent"
          className="absolute"
          style={{ left: barX(index) - (step - barW) / 2, width: step, top: TOP - 4, height: BASE - TOP + 8 }}
          onPress={() => onSelectDay(day.key === selectedDay ? null : day.key)}
        />
      ))}
    </View>
  );
}

function Bar({
  index,
  x,
  width,
  barTop,
  paceY,
  safeHeight,
  spent,
  animate,
}: {
  index: number;
  x: number;
  width: number;
  barTop: number;
  paceY: number | null;
  safeHeight: number;
  spent: boolean;
  animate: boolean;
}) {
  const rise = useSharedValue(animate ? BASE : 0);
  useEffect(() => {
    if (animate) rise.set(withDelay(index * 14, withSpring(0, springs.value)));
  }, [animate, index, rise]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: rise.get() }] }));
  const height = Math.max(spent ? 6 : 0, BASE - barTop);
  const top = BASE - height;
  const over = paceY !== null && spent && top < paceY ? paceY - top + 1 : 0;
  return (
    <View
      pointerEvents="none"
      className="absolute overflow-hidden"
      style={{ left: x, width, top: 0, height: BASE }}
    >
      <Animated.View className="absolute inset-0" style={style}>
        {safeHeight > 0 ? (
          <View
            className="absolute rounded-[6px] border-[1.2px] border-dashed border-foreground bg-card"
            style={{ left: 0, right: 0, top: top - 1.5 - safeHeight, height: safeHeight }}
          />
        ) : null}
        {spent ? (
          <View
            className="absolute overflow-hidden rounded-[6px] bg-primary"
            style={{ left: 0, right: 0, top, height }}
          >
            {over > 0 ? <View className="bg-coral" style={{ height: over }} /> : null}
          </View>
        ) : null}
      </Animated.View>
    </View>
  );
}

type BalancePlotProps = Pick<
  ActivityChartProps,
  'balance' | 'currency' | 'selectedDay' | 'onSelectDay' | 'now'
> & { width: number; month: string; screen?: Screen };

/** Closing balance per day across the month; the wallet page draws it for one wallet. */
export function BalancePlot({
  balance,
  currency,
  selectedDay,
  onSelectDay,
  width,
  month,
  now,
  screen = 'activity',
}: BalancePlotProps) {
  const tokens = useThemeTokens();
  const { days, daysInMonth } = balance;
  const values = days.map((d) => d.balanceMinor);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const stepMinor = niceStep(Math.max(100, (max - min) / 2));
  const lo = Math.floor(min / stepMinor) * stepMinor;
  const hi = Math.max(lo + stepMinor * 2, Math.ceil(max / stepMinor) * stepMinor);
  const BOTTOM = 142;
  const y = (minor: number) => BOTTOM - ((minor - lo) / (hi - lo)) * (BOTTOM - TOP);
  const left = AXIS + 8;
  const dx = (width - left - 4) / Math.max(1, daysInMonth - 1);
  const x = (index: number) => left + index * dx;
  const points = days.map((d, i) => `${x(i)},${y(d.balanceMinor)}`).join(' ');
  const last = days.length - 1;
  const area = `M${x(0)},${BOTTOM} L${points.replaceAll(' ', ' L')} L${x(last)},${BOTTOM} Z`;
  const found = days.findIndex((d) => d.key === selectedDay);
  const at = found >= 0 ? found : last;
  const selected = days[at];
  const scrubbed = useSharedValue(at);
  const reduceMotion = useReducedMotion();
  const reveal = useSharedValue(lineDrawnThisSession || reduceMotion ? 1 : 0);
  useEffect(() => {
    lineDrawnThisSession = true;
    reveal.set(withSpring(1, springs.value));
  }, [reveal]);
  useEffect(() => {
    scrubbed.set(at);
  }, [at, scrubbed]);
  const mask = useAnimatedStyle(() => ({
    transform: [{ translateX: reveal.get() * (width - left) }],
  }));

  const pick = (index: number) => {
    scrubStep();
    onSelectDay(days[index].key);
  };
  const scrub = Gesture.Pan()
    .activeOffsetX([-6, 6])
    .failOffsetY([-12, 12])
    .onUpdate((event) => {
      const index = Math.max(0, Math.min(last, Math.round((event.x - left) / dx)));
      if (index === scrubbed.get()) return;
      scrubbed.set(index);
      scheduleOnRN(pick, index);
    });

  const label = `Closing balance of the ${currency} wallets, 1 to ${days.length} ${month}, from ${formatMoney(values[0], currency)} to ${formatMoney(values[last], currency)}. The axis starts at ${formatMoney(lo, currency, { whole: true })}, not zero.`;

  return (
    <GestureDetector gesture={scrub}>
      <View style={{ height: PLOT_H + 22 }} accessibilityLabel={label}>
        <Svg width={width} height={PLOT_H + 8} style={{ position: 'absolute' }}>
          <Line x1={AXIS + 4} y1={TOP} x2={width} y2={TOP} stroke={tokens.hairline} strokeWidth={1.5} />
          <Line x1={AXIS + 4} y1={(TOP + BOTTOM) / 2} x2={width} y2={(TOP + BOTTOM) / 2} stroke={tokens.sandLight} strokeWidth={1.5} strokeDasharray="3 5" />
          <Line x1={AXIS + 4} y1={BOTTOM} x2={width} y2={BOTTOM} stroke={tokens.hairline} strokeWidth={1.5} />
          <Path d={area} fill={tokens.sand} opacity={0.8} />
          <Polyline
            points={points}
            fill="none"
            stroke={tokens.foreground}
            strokeWidth={3}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          <Line
            x1={x(at)}
            y1={38}
            x2={x(at)}
            y2={Math.max(38, y(selected.balanceMinor) - 7)}
            stroke={tokens.foreground}
            strokeWidth={1.5}
            strokeDasharray="3 3"
          />
        </Svg>
        <Animated.View
          pointerEvents="none"
          className="absolute bg-card"
          style={[{ left, top: TOP - 8, width: width - left, height: BOTTOM - TOP + 16 }, mask]}
        />
        <View
          pointerEvents="none"
          className="absolute h-3.5 w-3.5 rounded-full border-2 border-card bg-primary"
          style={{ left: x(at) - 7, top: y(selected.balanceMinor) - 7 }}
        />
        <View
          pointerEvents="none"
          className="absolute h-5 w-7 items-center justify-center rounded-full bg-primary"
          style={{ left: x(at) - 14, top: BOTTOM - 4 }}
        >
          <IconSymbol name="arrow-left-right" size={12} color={tokens.primaryForeground} />
        </View>
        <AxisLabel y={TOP} label={formatMoney(hi, currency, { whole: true })} />
        <AxisLabel y={(TOP + BOTTOM) / 2} label={formatMoney((hi + lo) / 2, currency, { whole: true })} />
        <AxisLabel y={BOTTOM} label={formatMoney(lo, currency, { whole: true })} />
        <XLabel width={width} x={x(0)} label={`1 ${month.slice(0, 3)}`} />
        {last > 2 && daysInMonth - 1 - last > 2 ? <XLabel width={width} x={x(last)} label="Today" strong /> : null}
        <XLabel width={width} x={x(daysInMonth - 1)} label={`${daysInMonth} ${month.slice(0, 3)}`} />
        <Callout
          x={x(at)}
          width={width}
          date={dayLabel(selected.key, now)}
          value={formatMoney(selected.balanceMinor, currency)}
        />
        {days.map((day, index) => (
          <Press
            key={day.key}
            testID={tid(screen, 'chart', 'day', day.key)}
            accessibilityLabel={`${dayLabel(day.key, now)}, closing balance ${formatMoney(day.balanceMinor, currency)}`}
            accessibilityState={{ selected: day.key === selectedDay }}
            pressedScale={1}
            pressedClassName="bg-transparent"
            className="absolute"
            style={{ left: x(index) - dx / 2, width: dx, top: TOP - 4, height: BOTTOM - TOP + 8 }}
            onPress={() => onSelectDay(day.key === selectedDay ? null : day.key)}
          />
        ))}
      </View>
    </GestureDetector>
  );
}
