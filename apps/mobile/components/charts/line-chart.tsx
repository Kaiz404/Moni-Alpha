import { useCallback, useMemo, useState } from 'react';
import { PanResponder, Pressable, Text, View } from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';

import {
  findNearestLinePointIndex,
  projectLinePoints,
  type ChartPadding,
} from './chart-utils';

export type LineChartDatum = {
  id: string;
  date: Date;
  value: number;
};

type LineChartProps = {
  data: LineChartDatum[];
  width: number;
  strokeColor: string;
  gridColor: string;
  surfaceColor: string;
  valueLabel: (value: number) => string;
  dateLabel: (date: Date) => string;
};

const HEIGHT = 196;
const PADDING: ChartPadding = {
  top: 18,
  right: 12,
  bottom: 28,
  left: 12,
};

function pathFromPoints(
  points: { chartX: number; chartY: number }[],
): string {
  return points
    .map(
      (point, index) =>
        `${index === 0 ? 'M' : 'L'} ${point.chartX.toFixed(2)} ${point.chartY.toFixed(2)}`,
    )
    .join(' ');
}

/**
 * A deliberately small, direct trend chart. Tap selects a point; a horizontal
 * drag moves the same selection without turning the whole screen into a chart
 * gesture surface.
 */
export function LineChart({
  data,
  width,
  strokeColor,
  gridColor,
  surfaceColor,
  valueLabel,
  dateLabel,
}: LineChartProps) {
  const ordered = useMemo(
    () =>
      [...data].sort((a, b) => a.date.getTime() - b.date.getTime()),
    [data],
  );
  const projected = useMemo(
    () =>
      projectLinePoints(
        ordered.map((datum) => ({
          x: datum.date.getTime(),
          y: datum.value,
        })),
        width,
        HEIGHT,
        PADDING,
      ),
    [ordered, width],
  );
  const [selectedIndex, setSelectedIndex] = useState<number | null>(
    null,
  );

  const activeIndex =
    selectedIndex !== null && selectedIndex < ordered.length
      ? selectedIndex
      : ordered.length - 1;
  const selected =
    activeIndex >= 0 ? (ordered[activeIndex] ?? null) : null;
  const selectedPoint =
    activeIndex >= 0 ? (projected[activeIndex] ?? null) : null;
  const selectAt = useCallback(
    (x: number) => {
      const index = findNearestLinePointIndex(projected, x);
      if (index !== null) setSelectedIndex(index);
    },
    [projected],
  );
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_event, gesture) =>
          Math.abs(gesture.dx) > 4 &&
          Math.abs(gesture.dx) > Math.abs(gesture.dy),
        onPanResponderGrant: (event) =>
          selectAt(event.nativeEvent.locationX),
        onPanResponderMove: (event) =>
          selectAt(event.nativeEvent.locationX),
      }),
    [selectAt],
  );

  if (!ordered.length) {
    return (
      <View
        className="items-center justify-center rounded-[22px] bg-surface-2 px-5 py-8"
        accessibilityLabel="No balance history to display"
      >
        <Text className="text-center text-base font-semibold text-foreground">
          Your trend will appear here
        </Text>
        <Text className="mt-1 text-center text-sm leading-5 text-muted">
          Add transactions in this currency to build a balance
          history.
        </Text>
      </View>
    );
  }

  const values = ordered.map((datum) => datum.value);
  const min = Math.min(...values);
  const max = Math.max(...values);

  return (
    <View>
      <Pressable
        className="overflow-hidden rounded-[22px]"
        onPress={(event) => selectAt(event.nativeEvent.locationX)}
        accessibilityRole="adjustable"
        accessibilityLabel="Balance trend. Tap or drag horizontally to inspect a date."
        accessibilityValue={
          selected
            ? {
                text: `${dateLabel(selected.date)}, ${valueLabel(selected.value)}`,
              }
            : undefined
        }
        {...panResponder.panHandlers}
      >
        <Svg
          width={width}
          height={HEIGHT}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          {[0.5].map((ratio) => {
            const y =
              PADDING.top +
              (HEIGHT - PADDING.top - PADDING.bottom) * ratio;
            return (
              <Line
                key={ratio}
                x1={PADDING.left}
                x2={width - PADDING.right}
                y1={y}
                y2={y}
                stroke={gridColor}
                strokeWidth={1}
                opacity={0.7}
              />
            );
          })}
          {selectedPoint ? (
            <Line
              x1={selectedPoint.chartX}
              x2={selectedPoint.chartX}
              y1={PADDING.top}
              y2={HEIGHT - PADDING.bottom}
              stroke={gridColor}
              strokeWidth={1}
              strokeDasharray="3 4"
              opacity={0.8}
            />
          ) : null}
          <Path
            d={pathFromPoints(projected)}
            fill="none"
            stroke={strokeColor}
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {selectedPoint ? (
            <Circle
              cx={selectedPoint.chartX}
              cy={selectedPoint.chartY}
              r={5}
              fill={surfaceColor}
              stroke={strokeColor}
              strokeWidth={3}
            />
          ) : null}
        </Svg>
        <View className="absolute bottom-1 left-3 right-3 flex-row justify-between">
          <Text className="text-[11px] font-medium text-muted">
            {dateLabel(ordered[0]!.date)}
          </Text>
          <Text className="text-[11px] font-medium text-muted">
            {dateLabel(ordered[ordered.length - 1]!.date)}
          </Text>
        </View>
      </Pressable>
      <View className="mt-3 flex-row items-start justify-between rounded-2xl bg-surface-2 px-3 py-2.5">
        <View className="flex-1 pr-3">
          <Text className="text-xs font-semibold text-muted">
            {selected ? dateLabel(selected.date) : 'Selected date'}
          </Text>
          <Text
            className="mt-0.5 text-lg font-bold text-foreground"
            style={{ fontVariant: ['tabular-nums'] }}
          >
            {selected ? valueLabel(selected.value) : '—'}
          </Text>
        </View>
        <Text className="pt-1 text-right text-xs leading-4 text-muted">
          {valueLabel(min)} min{`\n`}
          {valueLabel(max)} max
        </Text>
      </View>
    </View>
  );
}
