import { useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSpring,
} from 'react-native-reanimated';
import Svg, { Line } from 'react-native-svg';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { Press } from '@/components/ui/press';
import { Text } from '@/components/ui/text';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { rangeLabel, type ActivityRange } from '@/lib/finance/activity-filter';
import {
  FLOW_AXIS,
  FLOW_BASE,
  FLOW_PLOT_HEIGHT,
  FLOW_TOP,
  flowGeometry,
} from '@/lib/finance/flow-geometry';
import type { FlowBucket, FlowSeries } from '@/lib/finance/flow-series';
import { formatMoney } from '@/lib/finance/format-money';
import { scrubStep } from '@/lib/haptics';
import { springs } from '@/lib/motion/tokens';
import { tid } from '@/lib/test-ids';

const CALLOUT_W = 148;
const CALLOUT_RISE = 52;
const PLOT_WITH_LABELS = FLOW_PLOT_HEIGHT + 20;
let grownThisSession = false;

/**
 * Sits at full height inside a clip and slides by transform, so the top keeps its round corners,
 * the baseline stays flat, and no frame runs layout.
 */
function Bar({
  index,
  x,
  width,
  height,
  fill,
  grow,
}: {
  index: number;
  x: number;
  width: number;
  height: number;
  fill: string;
  grow: boolean;
}) {
  const reduced = useReducedMotion();
  const rest = FLOW_BASE - height;
  const offset = useSharedValue(grow && !reduced ? FLOW_BASE : rest);
  const entered = useRef(false);
  useEffect(() => {
    if (reduced) offset.set(rest);
    else {
      const settle = withSpring(rest, springs.value);
      offset.set(entered.current ? settle : withDelay(index * 14, settle));
    }
    entered.current = true;
  }, [index, offset, reduced, rest]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: offset.get() }] }));
  return (
    <View
      pointerEvents="none"
      className="absolute overflow-hidden"
      style={{ left: x, width, top: 0, height: FLOW_BASE }}
    >
      <Animated.View
        className={`absolute inset-x-0 top-0 ${fill}`}
        style={[
          {
            height: FLOW_BASE,
            borderTopLeftRadius: Math.min(6, width / 2),
            borderTopRightRadius: Math.min(6, width / 2),
          },
          style,
        ]}
      />
    </View>
  );
}

function FlowChart({
  series,
  currency,
  now,
  onNarrow,
}: {
  series: FlowSeries;
  currency: string;
  now: Date;
  onNarrow: (bucket: FlowBucket) => void;
}) {
  const tokens = useThemeTokens();
  const [width, setWidth] = useState(318);
  const [held, setHeld] = useState<number | null>(null);
  const geometry = useMemo(
    () => flowGeometry(series.buckets, width, currency),
    [series.buckets, width, currency],
  );
  const shape = `${series.range.from}:${series.range.to}`;
  const [firstShape] = useState(shape);
  const [moved, setMoved] = useState(false);
  if (shape !== firstShape && !moved) setMoved(true);
  const grow = !grownThisSession || moved;
  useEffect(() => {
    grownThisSession = true;
  }, []);

  const heldSlot = held === null ? null : (geometry.slots[held] ?? null);
  const heldBucket = held === null ? null : (series.buckets[held] ?? null);
  const guideX = heldSlot ? heldSlot.spentX + geometry.bar : 0;

  return (
    <View
      testID={tid('activity', 'chart')}
      accessibilityLabel={`Spent and money in, ${series.label}`}
      style={{ height: PLOT_WITH_LABELS }}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
    >
      {heldSlot ? (
        <View
          className="absolute rounded-[8px] bg-sand-light"
          style={{
            left: heldSlot.x + 1,
            width: Math.max(geometry.slot - 2, 2),
            top: FLOW_TOP - 4,
            height: FLOW_PLOT_HEIGHT - FLOW_TOP + 4,
          }}
        />
      ) : null}
      <Svg
        width={width}
        height={FLOW_PLOT_HEIGHT}
        style={{ position: 'absolute' }}
      >
        {[FLOW_TOP, FLOW_BASE].map((y) => (
          <Line
            key={y}
            x1={FLOW_AXIS}
            y1={y}
            x2={width}
            y2={y}
            stroke={tokens.hairline}
            strokeWidth={1.5}
          />
        ))}
        {heldSlot ? (
          <Line
            x1={guideX}
            y1={0}
            x2={guideX}
            y2={FLOW_BASE - Math.max(heldSlot.spentHeight, heldSlot.inHeight)}
            stroke={tokens.foreground}
            strokeWidth={1.5}
            strokeDasharray="3 3"
          />
        ) : null}
      </Svg>
      {[
        { y: FLOW_TOP, label: geometry.topLabel },
        { y: FLOW_BASE, label: geometry.zeroLabel },
      ].map(({ y, label }) => (
        <Text
          key={y}
          variant="smallest"
          className="absolute left-0 w-[38px] text-right text-muted"
          style={{ top: y - 8, fontVariant: ['tabular-nums'] }}
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          {label}
        </Text>
      ))}
      {geometry.slots.map((slot, index) => {
        const bucket = series.buckets[index];
        return (
          <View key={`${shape}:${slot.key}`}>
            <Bar
              index={index}
              x={slot.spentX}
              width={geometry.bar}
              height={slot.spentHeight}
              fill="bg-primary"
              grow={grow}
            />
            <Bar
              index={index}
              x={slot.inX}
              width={geometry.bar}
              height={slot.inHeight}
              fill="bg-deep-mint"
              grow={grow}
            />
            {slot.label ? (
              <Text
                variant="smallest"
                className="absolute text-center text-muted"
                style={{
                  left: slot.x + (geometry.slot - geometry.labelWidth) / 2,
                  width: geometry.labelWidth,
                  top: FLOW_PLOT_HEIGHT + 2,
                }}
                numberOfLines={1}
              >
                {slot.label}
              </Text>
            ) : null}
            <Press
              testID={tid('activity', 'chart', slot.key)}
              accessibilityLabel={`${rangeLabel(bucket, now)}: spent ${formatMoney(bucket.spentMinor, currency)}, money in ${formatMoney(bucket.inMinor, currency)}`}
              accessibilityHint="Shows these dates"
              pressedScale={1}
              unstable_pressDelay={60}
              onPressIn={() => setHeld(index)}
              onPressOut={() => setHeld(null)}
              onPress={() => {
                scrubStep();
                onNarrow(bucket);
              }}
              // A hold reads the bar's figures; only a tap narrows the dates.
              onLongPress={() => {}}
              className="absolute"
              style={{
                left: slot.x,
                width: geometry.slot,
                top: 0,
                height: PLOT_WITH_LABELS,
              }}
            />
          </View>
        );
      })}
      {heldSlot && heldBucket ? (
        <View
          pointerEvents="none"
          className="absolute justify-center rounded-[12px] bg-primary px-3 py-1.5"
          style={{
            top: -CALLOUT_RISE,
            width: CALLOUT_W,
            left: Math.max(0, Math.min(width - CALLOUT_W, guideX - CALLOUT_W / 2)),
          }}
        >
          <Text
            className="text-[12px] leading-[15px] text-primary-foreground/90"
            numberOfLines={1}
          >
            {rangeLabel(heldBucket, now)}
          </Text>
          {[
            { label: 'Spent', minor: heldBucket.spentMinor },
            { label: 'Money in', minor: heldBucket.inMinor },
          ].map(({ label, minor }) => (
            <Text
              key={label}
              className="text-[13px] leading-[17px] font-display-semibold text-primary-foreground"
              style={{ fontVariant: ['tabular-nums'] }}
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              {`${label} ${formatMoney(minor, currency)}`}
            </Text>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function Total({ label, fill, value }: { label: string; fill: string; value: string }) {
  return (
    <View className="min-w-0 flex-1">
      <View className="flex-row items-center gap-1.5">
        <View className={`h-2 w-2 rounded-full ${fill}`} />
        <Text
          variant="meta"
          className="text-muted"
          numberOfLines={1}
        >
          {label}
        </Text>
      </View>
      <Text
        className="text-[18px] leading-[24px] font-display-bold text-foreground"
        style={{ fontVariant: ['tabular-nums'] }}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {value}
      </Text>
    </View>
  );
}

/**
 * Leads Activity: the dates the list and chart cover, then what came in and went out across them.
 * The chart goes when there is nothing to draw, and the date control stays so the dates can change.
 */
export function FlowCard({
  series,
  range,
  currency,
  now,
  onPickRange,
  onClearRange,
  onNarrow,
}: {
  series: FlowSeries;
  range: ActivityRange | null;
  currency: string;
  now: Date;
  onPickRange: () => void;
  onClearRange: () => void;
  onNarrow: (bucket: FlowBucket) => void;
}) {
  const tokens = useThemeTokens();
  const drawn = series.spentMinor > 0 || series.inMinor > 0;
  const period = range || drawn ? series.label : 'All time';
  return (
    <View className="gap-2.5 rounded-card bg-card p-4">
      <View className="flex-row items-center justify-between gap-2">
        <Press
          testID={tid('activity', 'range')}
          accessibilityLabel={`Dates, ${period}`}
          accessibilityHint="Opens a picker"
          onPress={onPickRange}
          hitSlop={4}
          radius={{ rest: 18, pressed: 16 }}
          pressedClassName="bg-hairline"
          className="h-9 min-w-0 flex-shrink flex-row items-center gap-1 bg-sand pl-3.5 pr-2.5"
        >
          <Text
            className="flex-shrink text-[14px] leading-[19px] font-display-semibold text-foreground"
            numberOfLines={1}
          >
            {period}
          </Text>
          <IconSymbol
            name="chevron-down"
            size={18}
            color={tokens.foreground}
          />
        </Press>
        {range ? (
          <Press
            testID={tid('activity', 'range', 'clear')}
            accessibilityLabel="Clear dates"
            onPress={onClearRange}
            hitSlop={4}
            pressedClassName="bg-hairline"
            className="h-9 w-9 items-center justify-center rounded-full bg-sand"
          >
            <IconSymbol
              name="close"
              size={18}
              color={tokens.foreground}
            />
          </Press>
        ) : drawn ? (
          <Text
            variant="meta"
            className="flex-shrink text-muted"
            numberOfLines={1}
          >
            List shows all time
          </Text>
        ) : null}
      </View>
      {drawn ? (
        <>
          <View className="flex-row gap-4">
            <Total
              label="Spent"
              fill="bg-primary"
              value={formatMoney(series.spentMinor, currency)}
            />
            <Total
              label="Money in"
              fill="bg-deep-mint"
              value={formatMoney(series.inMinor, currency)}
            />
          </View>
          <FlowChart
            series={series}
            currency={currency}
            now={now}
            onNarrow={onNarrow}
          />
        </>
      ) : null}
    </View>
  );
}
