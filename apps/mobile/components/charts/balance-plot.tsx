import type { CurrencyCode } from '@repo/types';
import { useEffect } from 'react';
import { View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import Svg, { Line, Path, Polyline } from 'react-native-svg';
import { scheduleOnRN } from 'react-native-worklets';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { Press } from '@/components/ui/press';
import { Text } from '@/components/ui/text';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { dayLabel } from '@/lib/dates/day-label';
import type { BalanceMonth } from '@/lib/finance/activity-series';
import { formatMoney } from '@/lib/finance/format-money';
import { chartStep } from '@/lib/haptics';
import { springs } from '@/lib/motion/tokens';
import { tid, type Screen } from '@/lib/test-ids';


const PLOT_H = 150;
const TOP = 44;
const AXIS = 50;
const CALLOUT_W = 100;

let lineDrawnThisSession = false;

function niceStep(span: number): number {
  const magnitude = 10 ** Math.floor(Math.log10(Math.max(span, 1)));
  return [1, 2, 2.5, 5, 10].map((f) => f * magnitude).find((s) => s >= span) ?? magnitude * 10;
}

/** A day under the plot: centred on `x`, or `start` from the axis and `end` at the right edge. */
function XLabel({
  x,
  width,
  label,
  strong,
  align = 'center',
}: {
  x: number;
  width: number;
  label: string;
  strong?: boolean;
  align?: 'start' | 'center' | 'end';
}) {
  const left =
    align === 'start'
      ? AXIS
      : align === 'end'
        ? width - 60
        : Math.min(width - 60, Math.max(AXIS - 10, x - 30));
  const textAlign = align === 'start' ? 'text-left' : align === 'end' ? 'text-right' : 'text-center';
  return (
    <Text
      variant="smallest"
      className={`absolute w-[60px] ${textAlign} ${strong ? 'font-display-bold text-foreground' : 'text-muted'}`}
      style={{ left, top: PLOT_H + 8 }}
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
      <Text className="text-[12px] leading-[15px] text-primary-foreground/90">
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

type BalancePlotProps = {
  balance: BalanceMonth;
  currency: CurrencyCode;
  /** Local `YYYY-MM-DD`; the callout sits on today without one. */
  selectedDay: string | null;
  onSelectDay: (day: string | null) => void;
  now: Date;
  width: number;
  month: string;
  screen?: Screen;
};

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
  const gridLeft = AXIS + 4;
  const gridRight = width - 4;
  const dx = (gridRight - gridLeft) / Math.max(1, daysInMonth);
  const x = (index: number) => gridLeft + (index + 1) * dx;
  const left = x(0);
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
    chartStep(days.length);
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
      <View style={{ height: PLOT_H + 24 }} accessibilityLabel={label}>
        <Svg width={width} height={PLOT_H + 8} style={{ position: 'absolute' }}>
          <Line x1={gridLeft} y1={TOP} x2={gridRight} y2={TOP} stroke={tokens.hairline} strokeWidth={1.5} />
          <Line x1={gridLeft} y1={(TOP + BOTTOM) / 2} x2={gridRight} y2={(TOP + BOTTOM) / 2} stroke={tokens.sandLight} strokeWidth={1.5} strokeDasharray="3 5" />
          <Line x1={gridLeft} y1={BOTTOM} x2={gridRight} y2={BOTTOM} stroke={tokens.hairline} strokeWidth={1.5} />
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
          className="absolute h-[17px] w-[17px] rounded-full bg-primary p-[1.5px]"
          style={{ left: x(at) - 8.5, top: y(selected.balanceMinor) - 8.5 }}
        >
          <View className="h-3.5 w-3.5 rounded-full border-[3px] border-card bg-primary" />
        </View>
        <View
          pointerEvents="none"
          className="absolute h-5 w-7 items-center justify-center rounded-full bg-primary"
          style={{ left: x(at) - 14, top: BOTTOM - 10 }}
        >
          <IconSymbol name="arrow-left-right" size={14} color={tokens.primaryForeground} />
        </View>
        <AxisLabel y={TOP} label={formatMoney(hi, currency, { whole: true })} />
        <AxisLabel y={(TOP + BOTTOM) / 2} label={formatMoney((hi + lo) / 2, currency, { whole: true })} />
        <AxisLabel y={BOTTOM} label={formatMoney(lo, currency, { whole: true })} />
        <XLabel width={width} x={x(0)} label={`1 ${month.slice(0, 3)}`} align="start" />
        {last > 2 && daysInMonth - 1 - last > 2 ? <XLabel width={width} x={x(last)} label="Today" strong /> : null}
        <XLabel width={width} x={x(daysInMonth - 1)} label={`${daysInMonth} ${month.slice(0, 3)}`} align="end" />
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
