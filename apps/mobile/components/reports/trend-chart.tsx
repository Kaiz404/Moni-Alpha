import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSpring,
} from 'react-native-reanimated';
import Svg, { Line } from 'react-native-svg';

import { Press } from '@/components/ui/press';
import { Text } from '@/components/ui/text';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { monthName, type MonthKey } from '@/lib/finance/budget-month';
import { formatMoney } from '@/lib/finance/format-money';
import { scrubStep } from '@/lib/haptics';
import { springs } from '@/lib/motion/tokens';
import type { ReportMonth } from '@/lib/reports/report';
import {
  TREND_AXIS,
  TREND_BAR,
  TREND_BASE,
  TREND_PLOT_HEIGHT,
  TREND_TOP,
  trendGeometry,
} from '@/lib/reports/trend-geometry';
import { tid } from '@/lib/test-ids';

const CALLOUT_W = 100;
let grownThisSession = false;

function Bar({
  index,
  x,
  height,
  fill,
  animate,
}: {
  index: number;
  x: number;
  height: number;
  fill: string;
  animate: boolean;
}) {
  const rise = useSharedValue(animate ? TREND_BASE : 0);
  useEffect(() => {
    if (animate) rise.set(withDelay(index * 14, withSpring(0, springs.value)));
  }, [animate, index, rise]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: rise.get() }] }));
  if (!height) return null;
  return (
    <View
      pointerEvents="none"
      className="absolute overflow-hidden"
      style={{ left: x, width: TREND_BAR, top: 0, height: TREND_BASE }}
    >
      <Animated.View
        className={`absolute inset-x-0 rounded-[6px] ${fill}`}
        style={[{ top: TREND_BASE - height, height }, style]}
      />
    </View>
  );
}

/** Six months of Spent against Money in; tapping a month opens its report. */
export function TrendChart({
  trend,
  selected,
  currency,
  onSelect,
}: {
  trend: readonly ReportMonth[];
  selected: MonthKey | null;
  currency: string;
  onSelect: (month: MonthKey) => void;
}) {
  const tokens = useThemeTokens();
  const [width, setWidth] = useState(314);
  const geometry = useMemo(
    () => trendGeometry(trend, width, selected, currency),
    [trend, width, selected, currency],
  );
  const reduceMotion = useReducedMotion();
  const animate = !grownThisSession && !reduceMotion;
  useEffect(() => {
    grownThisSession = true;
  }, []);
  const chosenIndex = geometry.slots.findIndex((slot) => slot.selected);
  const chosen = chosenIndex < 0 ? null : geometry.slots[chosenIndex];
  const guideX = chosen ? chosen.spentX + TREND_BAR : 0;

  return (
    <View className="gap-2">
      <View
        testID={tid('reports', 'trend')}
        accessibilityLabel={`Spent and money in, ${monthName(trend[0].month)} to ${monthName(trend[trend.length - 1].month)}`}
        style={{ height: TREND_PLOT_HEIGHT + 24 }}
        onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      >
        {chosen ? (
          <View
            className="absolute rounded-[8px] bg-sand-light"
            style={{
              left: chosen.x + 2,
              width: geometry.slot - 4,
              top: TREND_TOP - 4,
              height: TREND_PLOT_HEIGHT - TREND_TOP + 4,
            }}
          />
        ) : null}
        <Svg
          width={width}
          height={TREND_PLOT_HEIGHT}
          style={{ position: 'absolute' }}
        >
          <Line
            x1={TREND_AXIS}
            y1={TREND_TOP}
            x2={width}
            y2={TREND_TOP}
            stroke={tokens.hairline}
            strokeWidth={1.5}
          />
          <Line
            x1={TREND_AXIS}
            y1={TREND_BASE}
            x2={width}
            y2={TREND_BASE}
            stroke={tokens.hairline}
            strokeWidth={1.5}
          />
          {chosen ? (
            <Line
              x1={guideX}
              y1={38}
              x2={guideX}
              y2={TREND_BASE - Math.max(chosen.spentHeight, chosen.inHeight)}
              stroke={tokens.foreground}
              strokeWidth={1.5}
              strokeDasharray="3 3"
            />
          ) : null}
        </Svg>
        {[
          { y: TREND_TOP, label: geometry.topLabel },
          { y: TREND_BASE, label: geometry.zeroLabel },
        ].map(({ y, label }) => (
          <Text
            key={label}
            variant="smallest"
            className="absolute left-0 w-[44px] text-right text-muted"
            style={{ top: y - 8, fontVariant: ['tabular-nums'] }}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            {label}
          </Text>
        ))}
        {geometry.slots.map((slot, index) => (
          <View key={slot.month}>
            <Bar
              index={index}
              x={slot.spentX}
              height={slot.spentHeight}
              fill="bg-primary"
              animate={animate}
            />
            <Bar
              index={index}
              x={slot.inX}
              height={slot.inHeight}
              fill="bg-deep-mint"
              animate={animate}
            />
            <Text
              variant="smallest"
              className={`absolute text-center ${slot.selected ? 'font-display-bold text-foreground' : 'text-muted'}`}
              style={{ left: slot.x, width: geometry.slot, top: TREND_PLOT_HEIGHT + 8 }}
              numberOfLines={1}
            >
              {slot.label}
            </Text>
            <Press
              testID={tid('reports', 'trend', slot.month)}
              onPress={() => {
                scrubStep();
                onSelect(slot.month);
              }}
              accessibilityLabel={`${monthName(slot.month)}: spent ${formatMoney(trend[index].spentMinor, currency)}, money in ${formatMoney(trend[index].inMinor, currency)}`}
              accessibilityState={{ selected: slot.selected }}
              pressedScale={1}
              className="absolute"
              style={{
                left: slot.x,
                width: geometry.slot,
                top: TREND_TOP - 4,
                height: TREND_PLOT_HEIGHT - TREND_TOP + 28,
              }}
            />
          </View>
        ))}
        {chosen ? (
          <View
            pointerEvents="none"
            className="absolute top-0 h-[38px] items-center justify-center rounded-[12px] bg-primary"
            style={{
              width: CALLOUT_W,
              left: Math.max(0, Math.min(width - CALLOUT_W, guideX - CALLOUT_W / 2)),
            }}
          >
            <Text className="text-[12px] leading-[15px] text-primary-foreground/90">
              {`Spent in ${chosen.label}`}
            </Text>
            <Text
              className="text-[14px] leading-[18px] font-display-bold text-primary-foreground"
              style={{ fontVariant: ['tabular-nums'] }}
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              {formatMoney(trend[chosenIndex].spentMinor, currency)}
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}
