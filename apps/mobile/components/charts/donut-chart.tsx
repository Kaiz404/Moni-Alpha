import { Fragment, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Svg, { Circle, Path, Text as SvgText } from 'react-native-svg';
import glyphMap from '@react-native-vector-icons/material-design-icons/glyphmaps/MaterialDesignIcons.json';

import { CategoryIcon } from '@/components/categories/category-icon';
import { arcPath, buildDonutSegments } from './chart-utils';

export type DonutDatum = {
  id: string;
  label: string;
  value: number;
  color: string | null;
  icon: string | null;
};

type DonutChartProps = {
  data: DonutDatum[];
  colors: readonly string[];
  surfaceColor: string;
  mutedColor: string;
  size?: number;
  valueLabel: (value: number) => string;
  onSelect?: (datum: DonutDatum | null) => void;
};

/**
 * A tappable, category-aware composition chart. The chart intentionally keeps
 * its supporting list in the same component so colour is never the only way a
 * person has to understand the data.
 */
export function DonutChart({
  data,
  colors,
  surfaceColor,
  mutedColor,
  size = 208,
  valueLabel,
  onSelect,
}: DonutChartProps) {
  const items = useMemo(
    () => data.filter((item) => item.value > 0),
    [data],
  );
  const segments = useMemo(() => buildDonutSegments(items), [items]);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(
    null,
  );
  const total = useMemo(
    () => items.reduce((sum, item) => sum + item.value, 0),
    [items],
  );

  const activeIndex =
    selectedIndex !== null && selectedIndex < items.length
      ? selectedIndex
      : null;
  const selected =
    activeIndex === null ? null : (items[activeIndex] ?? null);
  const centerItem = selected ?? items[0] ?? null;
  const radius = size / 2 - 10;
  const iconRadius = radius * 0.66;

  const select = (index: number | null) => {
    setSelectedIndex(index);
    onSelect?.(index === null ? null : (items[index] ?? null));
  };

  if (!items.length) {
    return (
      <View
        className="items-center justify-center rounded-[22px] bg-surface-2 px-5 py-8"
        accessibilityLabel="No expense categories to display"
      >
        <View className="mb-3 h-14 w-14 rounded-full bg-card" />
        <Text className="text-center text-base font-semibold text-foreground">
          Nothing to compare yet
        </Text>
        <Text className="mt-1 text-center text-sm leading-5 text-muted">
          Expenses in this currency will appear here by category.
        </Text>
      </View>
    );
  }

  return (
    <View accessibilityRole="summary">
      <View
        className="items-center justify-center"
        style={{ height: size }}
      >
        <Svg
          width={size}
          height={size}
          accessibilityLabel="Expense category composition"
        >
          {segments.map((segment) => {
            const datum = items[segment.index]!;
            const color =
              datum.color ??
              colors[segment.index % colors.length] ??
              mutedColor;
            const isSelected = activeIndex === segment.index;
            return (
              <Path
                key={datum.id}
                d={arcPath(
                  size / 2,
                  radius,
                  segment.startAngle,
                  segment.endAngle,
                )}
                fill={color}
                stroke={surfaceColor}
                strokeWidth={isSelected ? 5 : 3}
                opacity={
                  activeIndex === null || isSelected ? 1 : 0.48
                }
                onPress={() => select(segment.index)}
              />
            );
          })}
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius * 0.53}
            fill={surfaceColor}
          />
          {segments.map((segment) => {
            const datum = items[segment.index]!;
            if (!datum.icon || segment.percentage < 0.1) return null;
            const codepoint =
              glyphMap[datum.icon as keyof typeof glyphMap];
            if (!codepoint) return null;
            const iconX =
              size / 2 + iconRadius * Math.cos(segment.midAngle);
            const iconY =
              size / 2 + iconRadius * Math.sin(segment.midAngle) + 5;
            return (
              <Fragment key={`${datum.id}-icon-group`}>
                <Circle
                  key={`${datum.id}-icon-badge`}
                  cx={iconX}
                  cy={iconY - 5}
                  fill={surfaceColor}
                  opacity={0.92}
                  pointerEvents="none"
                  r={11}
                />
                <SvgText
                  key={`${datum.id}-icon`}
                  x={iconX}
                  y={iconY}
                  fill={mutedColor}
                  fontFamily="MaterialDesignIcons"
                  fontSize={14}
                  textAnchor="middle"
                  pointerEvents="none"
                >
                  {String.fromCodePoint(codepoint)}
                </SvgText>
              </Fragment>
            );
          })}
        </Svg>
        <View
          pointerEvents="none"
          className="absolute items-center px-8"
          style={{ maxWidth: size * 0.54 }}
        >
          <Text
            className="text-center text-[12px] font-semibold text-muted"
            numberOfLines={1}
          >
            {centerItem?.label ?? 'Expenses'}
          </Text>
          <Text
            className="mt-1 text-center text-lg font-bold text-foreground"
            numberOfLines={1}
            style={{ fontVariant: ['tabular-nums'] }}
          >
            {valueLabel(centerItem?.value ?? total)}
          </Text>
          {selected && total > 0 ? (
            <Text className="mt-0.5 text-center text-[11px] font-medium text-muted">
              {Math.round((selected.value / total) * 100)}% of
              spending
            </Text>
          ) : null}
        </View>
      </View>

      <View className="mt-4 gap-1">
        {items.slice(0, 6).map((datum, index) => {
          const percentage = Math.round((datum.value / total) * 100);
          const color =
            datum.color ??
            colors[index % colors.length] ??
            mutedColor;
          const isSelected = activeIndex === index;
          return (
            <Pressable
              key={datum.id}
              className={`min-h-11 flex-row items-center justify-between rounded-xl px-2 py-1.5 ${isSelected ? 'bg-surface-2' : ''}`}
              onPress={() => select(isSelected ? null : index)}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              accessibilityLabel={`${datum.label}, ${valueLabel(datum.value)}, ${percentage} percent`}
            >
              <View className="min-w-0 flex-1 flex-row items-center pr-3">
                <View
                  className="mr-2 h-3 w-3 rounded-full"
                  style={{ backgroundColor: color }}
                />
                {datum.icon ? (
                  <View className="mr-1.5">
                    <CategoryIcon
                      color={color}
                      icon={datum.icon}
                      size={17}
                    />
                  </View>
                ) : null}
                <Text
                  className="flex-1 text-sm font-medium text-foreground"
                  numberOfLines={1}
                >
                  {datum.label}
                </Text>
              </View>
              <Text
                className="text-sm font-semibold text-foreground"
                style={{ fontVariant: ['tabular-nums'] }}
              >
                {percentage}%
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
