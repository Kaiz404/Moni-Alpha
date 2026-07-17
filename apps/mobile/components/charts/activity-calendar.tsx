import { Pressable, Text, View } from 'react-native';

import {
  buildActivityCalendar,
  type ActivityDay,
} from './chart-utils';

type ActivityCalendarProps = {
  month: string;
  activities: ActivityDay[];
  selectedDate: string | null;
  onSelectDate: (date: string | null) => void;
};

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function monthLabel(month: string): string {
  const [year, monthNumber] = month.split('-').map(Number);
  if (!year || !monthNumber) return month;
  return new Intl.DateTimeFormat(undefined, {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, monthNumber - 1, 1)));
}

/** A currency-scoped calendar that makes activity discoverable by date. */
export function ActivityCalendar({
  month,
  activities,
  selectedDate,
  onSelectDate,
}: ActivityCalendarProps) {
  const cells = buildActivityCalendar(month, activities);
  const weeks = Array.from(
    { length: Math.ceil(cells.length / 7) },
    (_, week) => cells.slice(week * 7, week * 7 + 7),
  );

  return (
    <View accessibilityRole="summary" accessibilityLabel={`Transaction activity for ${monthLabel(month)}`}>
      <View className="mb-2 flex-row">
        {WEEKDAYS.map((weekday, index) => (
          <View key={`${weekday}-${index}`} className="flex-1 items-center">
            <Text className="text-[11px] font-semibold text-muted">
              {weekday}
            </Text>
          </View>
        ))}
      </View>
      <View className="gap-1.5">
        {weeks.map((week, weekIndex) => (
          <View key={weekIndex} className="flex-row gap-1.5">
            {week.map((cell, dayIndex) => {
              if (!cell.dateKey || cell.day === null) {
                return <View key={`blank-${dayIndex}`} className="aspect-square flex-1" />;
              }
              const active = cell.transactionCount > 0;
              const selected = selectedDate === cell.dateKey;
              return (
                <Pressable
                  key={cell.dateKey}
                  className={`aspect-square flex-1 items-center justify-center overflow-hidden rounded-xl ${selected ? 'border-2 border-primary bg-primary-muted' : 'bg-surface-1'}`}
                  onPress={() =>
                    onSelectDate(selected ? null : cell.dateKey)
                  }
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  accessibilityLabel={
                    active
                      ? `${cell.dateKey}, ${cell.transactionCount} transaction${cell.transactionCount === 1 ? '' : 's'}`
                      : `${cell.dateKey}, no transactions`
                  }
                >
                  {active ? (
                    <View
                      pointerEvents="none"
                      className="absolute inset-0 bg-primary"
                      style={{ opacity: 0.18 + cell.intensity * 0.7 }}
                    />
                  ) : null}
                  <Text
                    className={`text-xs font-semibold ${active || selected ? 'text-foreground' : 'text-muted'}`}
                    style={{ fontVariant: ['tabular-nums'] }}
                  >
                    {cell.day}
                  </Text>
                  {active ? (
                    <View className="mt-0.5 h-1 w-1 rounded-full bg-foreground" />
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>
    </View>
  );
}
