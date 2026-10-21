import { View } from 'react-native';

import { Press } from '@/components/ui/press';
import { Text } from '@/components/ui/text';
import type {
  HeatBucket,
  HeatDay,
} from '@/lib/finance/calendar-heat';
import { formatMoney } from '@/lib/finance/format-money';
import { tid } from '@/lib/test-ids';

const WEEKDAY_INITIALS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const WEEKDAYS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

const fills: Record<HeatBucket, string> = {
  under: 'bg-mint',
  x1_5: 'bg-lemon',
  x2: 'bg-peach',
  over_x2: 'bg-coral',
  plain: 'bg-canvas',
  future: 'bg-canvas',
};

const LEGEND: { label: string; fill: string }[] = [
  { label: 'Under', fill: 'bg-mint' },
  { label: '1.5×', fill: 'bg-lemon' },
  { label: '2×', fill: 'bg-peach' },
  { label: 'Over 2×', fill: 'bg-coral' },
];

type CalendarHeatProps = {
  /** `YYYY-MM`. */
  month: string;
  monthName: string;
  days: readonly HeatDay[];
  /** Today's day of month when this month is the current one. */
  today: number | null;
  selected: number;
  currency: string;
  /** Bill names due on a day, for the screen reader. */
  billNames: Record<number, string>;
  onSelect: (day: number) => void;
};

/** The month as a heat grid against even pace (`V2P-InsightsCalendar`). */
export function CalendarHeat({
  month,
  monthName,
  days,
  today,
  selected,
  currency,
  billNames,
  onSelect,
}: CalendarHeatProps) {
  const [year, number] = month.split('-').map(Number);
  const offset = new Date(year, number - 1, 1).getDay();
  const cells: (HeatDay | null)[] = [
    ...Array.from({ length: offset }, () => null),
    ...days,
  ];
  while (cells.length % 7) cells.push(null);
  const weeks = Array.from({ length: cells.length / 7 }, (_, week) =>
    cells.slice(week * 7, week * 7 + 7),
  );
  const colored = days.some(
    (day) => day.bucket !== 'plain' && day.bucket !== 'future',
  );

  return (
    <View
      accessibilityLabel={`${monthName} calendar. Tap a day`}
      className="gap-2 rounded-card bg-card px-2.5 py-3"
    >
      <View
        className="flex-row gap-1"
        importantForAccessibility="no-hide-descendants"
      >
        {WEEKDAY_INITIALS.map((initial, index) => (
          <Text
            key={index}
            className="flex-1 text-center text-[12px] leading-4 font-display-bold text-muted"
          >
            {initial}
          </Text>
        ))}
      </View>
      <View className="gap-1">
        {weeks.map((week, row) => (
          <View
            key={row}
            className="flex-row gap-1"
          >
            {week.map((day, column) =>
              day ? (
                <DayCell
                  key={column}
                  day={day}
                  month={month}
                  monthName={monthName}
                  today={today === day.day}
                  selected={selected === day.day}
                  currency={currency}
                  billName={billNames[day.day]}
                  onSelect={onSelect}
                />
              ) : (
                <View
                  key={column}
                  className="h-11 flex-1"
                />
              ),
            )}
          </View>
        ))}
      </View>
      {colored ? (
        <View
          className="flex-row justify-between gap-1.5 px-1.5 pt-0.5"
          importantForAccessibility="no-hide-descendants"
        >
          {LEGEND.map((item) => (
            <View
              key={item.label}
              className="flex-row items-center gap-1"
            >
              <View
                className={`h-2.5 w-2.5 rounded-full ${item.fill}`}
              />
              <Text className="text-[12px] leading-4 text-ink-2">
                {item.label}
              </Text>
            </View>
          ))}
          <View className="flex-row items-center gap-1">
            <View className="h-1.5 w-1.5 rounded-full bg-primary" />
            <Text className="text-[12px] leading-4 text-ink-2">
              Due
            </Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}

function DayCell({
  day,
  month,
  monthName,
  today,
  selected,
  currency,
  billName,
  onSelect,
}: {
  day: HeatDay;
  month: string;
  monthName: string;
  today: boolean;
  selected: boolean;
  currency: string;
  billName: string | undefined;
  onSelect: (day: number) => void;
}) {
  const [year, number] = month.split('-').map(Number);
  const weekday =
    WEEKDAYS[new Date(year, number - 1, day.day).getDay()];
  const spent = day.spentMinor === null ? 0 : Number(day.spentMinor);
  const label = [
    `${weekday} ${day.day} ${monthName}`,
    spent > 0 ? `spent ${formatMoney(spent, currency)}` : null,
    billName ? `${billName} is due` : null,
    today ? 'today' : null,
  ]
    .filter(Boolean)
    .join(', ');
  const ink = selected
    ? 'text-primary-foreground'
    : day.bucket === 'future' || day.bucket === 'plain'
      ? 'text-muted'
      : 'text-on-pastel';
  return (
    <Press
      testID={tid('budget', 'calendar', 'day', day.day)}
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      onPress={() => onSelect(day.day)}
      pressedClassName="bg-sand-light"
      className={`h-11 flex-1 items-center justify-center rounded-[14px] ${selected ? 'bg-primary' : fills[day.bucket]} ${today && !selected ? 'border-2 border-primary' : ''}`}
    >
      <Text
        className={`text-[13px] leading-4 font-display-bold ${ink}`}
      >
        {day.day}
      </Text>
      {spent > 0 ? (
        <Text
          className={`text-[12px] leading-[14px] ${selected ? 'text-primary-foreground' : 'text-ink-2'}`}
          style={{ fontVariant: ['tabular-nums'] }}
        >
          {Math.round(spent / 100)}
        </Text>
      ) : null}
      {billName ? (
        <View
          className={`absolute right-1.5 top-[5px] h-1.5 w-1.5 rounded-full ${selected ? 'bg-primary-foreground' : 'bg-primary'}`}
        />
      ) : null}
    </Press>
  );
}
