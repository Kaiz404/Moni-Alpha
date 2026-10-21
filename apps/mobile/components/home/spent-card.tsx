import { useState } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Line, Rect } from 'react-native-svg';

import { ChartToggle } from '@/components/charts/chart-toggle';
import { PaceChart } from '@/components/charts/pace-chart';
import { monthFromKey, monthName } from '@/components/charts/pace-geometry';
import { Text } from '@/components/ui/text';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { currencySymbol, formatMoney } from '@/lib/finance/format-money';
import { tid } from '@/lib/test-ids';

import type { BudgetMonth } from '@/lib/finance/budget-month';
import { leftLine } from '@/lib/finance/spent-summary';

type Mode = 'pace' | 'daily';

const MODES = [
  { value: 'pace', label: 'Pace' },
  { value: 'daily', label: 'Daily' },
] as const;

/** "Spent in October": spent of budget, what's left, and the Pace / Daily chart. */
export function SpentCard({
  month,
  currency,
  after,
}: {
  month: BudgetMonth;
  currency: string;
  /** D1 label when no bills strip carries it: "RM40 to Mei". */
  after?: string | null;
}) {
  const [mode, setMode] = useState<Mode>('pace');
  const empty = month.spentMinor === 0 && month.budgetMinor === null;
  const line = month.left ? leftLine(month.left, currency, after) : null;
  const chartMonth = monthFromKey(month.month);
  const name = monthName(chartMonth);

  return (
    <View
      accessibilityLabel={`Spent in ${name}`}
      className="gap-2 rounded-card bg-card px-[18px] py-3.5"
    >
      <View className="flex-row items-center justify-between gap-2">
        <Text
          variant="caps"
          className="text-muted"
          accessibilityRole="header"
        >
          {`Spent in ${name}`}
        </Text>
        <ChartToggle
          screen="home"
          options={MODES}
          value={mode}
          onChange={setMode}
        />
      </View>
      <View>
        <Text
          testID={tid('home', 'spent', 'amount')}
          className={`text-[32px] leading-9 font-display-bold ${empty ? 'text-muted' : 'text-foreground'}`}
          style={{ fontVariant: ['tabular-nums'] }}
        >
          {formatMoney(month.spentMinor, currency)}
          {month.budgetMinor !== null || empty ? (
            <Text
              className={`text-[17px] leading-[22px] font-display-semibold ${empty ? 'text-muted' : 'text-ink-2'}`}
            >
              {` of ${month.budgetMinor === null ? `${currencySymbol(currency)}–` : formatMoney(month.budgetMinor, currency, { whole: true })}`}
            </Text>
          ) : null}
        </Text>
        {line ? (
          <Text
            testID={tid('home', 'spent', 'left')}
            variant="meta"
            className="text-ink-2"
          >
            {line}
          </Text>
        ) : null}
      </View>
      {empty ? (
        <EmptyChart
          mode={mode}
          today={month.throughDay}
          days={month.daysInMonth}
          monthShort={name.slice(0, 3)}
          currency={currency}
        />
      ) : (
        <PaceChart
          screen="home"
          mode={mode}
          series={{ month: chartMonth, values: month.daily.slice(0, month.throughDay) }}
          budget={month.budgetMinor}
          currency={currency}
          safePerDay={month.left && month.left.perDayMinor > 0 ? month.left.perDayMinor : null}
        />
      )}
    </View>
  );
}

/** V2H-HomeFirstRun: the chart's shape with a hint until there is spending or a budget. */
function EmptyChart({
  mode,
  today,
  days,
  monthShort,
  currency,
}: {
  mode: Mode;
  today: number;
  days: number;
  monthShort: string;
  currency: string;
}) {
  const tokens = useThemeTokens();
  const [width, setWidth] = useState(314);
  const symbol = currencySymbol(currency);
  const right = width - 4;
  const step = (right - 54) / days;
  const todayX = mode === 'pace' ? 54 + today * step : 0;
  const slot = Math.min(24, (width - 74) / Math.max(today, 1));
  return (
    <View
      className="gap-1.5"
      importantForAccessibility="no-hide-descendants"
    >
      <View
        style={{ height: 120 }}
        onLayout={(event) =>
          setWidth(Math.round(event.nativeEvent.layout.width))
        }
      >
        <Svg
          width={width}
          height={120}
          viewBox={`0 30 ${width} 120`}
          style={{ position: 'absolute' }}
        >
          {mode === 'pace' ? (
            <>
              <Line x1={54} y1={44} x2={right} y2={44} stroke={tokens.hairline} strokeWidth={1.5} strokeDasharray="5 5" />
              <Line x1={54} y1={142} x2={right} y2={142} stroke={tokens.hairline} strokeWidth={1.5} />
              <Line x1={54} y1={142} x2={right} y2={44} stroke={tokens.hairline} strokeWidth={1.5} strokeDasharray="5 5" />
              <Line x1={todayX} y1={44} x2={todayX} y2={135} stroke={tokens.foreground} strokeWidth={1.5} strokeDasharray="3 4" />
              <Circle cx={todayX} cy={142} r={6} fill={tokens.card} stroke={tokens.foreground} strokeWidth={2.5} />
            </>
          ) : (
            <>
              <Line x1={50} y1={141.2} x2={width} y2={141.2} stroke={tokens.hairline} strokeWidth={1.5} />
              {Array.from({ length: today }, (_, index) => (
                <Rect
                  key={index}
                  x={50 + slot * index + slot / 2 - 6}
                  y={134.5}
                  width={12}
                  height={6}
                  rx={3}
                  fill={tokens.sandLight}
                />
              ))}
            </>
          )}
        </Svg>
        {mode === 'pace' ? (
          <Text variant="smallest" className="absolute w-11 text-right text-muted" style={{ left: 0, top: 6 }}>
            {`${symbol}–`}
          </Text>
        ) : null}
        <Text variant="smallest" className="absolute w-11 text-right text-muted" style={{ left: 0, top: 104 }}>
          {`${symbol}0`}
        </Text>
        <View
          className="absolute rounded-[14px] bg-canvas px-3 py-2"
          style={{ left: 60, top: 28, width: 204 }}
        >
          <Text variant="meta" className="text-ink-2">
            {mode === 'pace'
              ? 'Your spending draws a line here, day by day, against an even pace.'
              : 'Each day gets a bar, with a line at even pace.'}
          </Text>
        </View>
      </View>
      <View style={{ height: 16 }}>
        <Text variant="smallest" className="absolute text-muted" style={{ left: 50 }}>
          {`1 ${monthShort}`}
        </Text>
        <Text
          variant="smallest"
          className="absolute w-[50px] text-center font-display-bold text-foreground"
          style={{ left: (mode === 'pace' ? todayX : 50 + slot * today - slot / 2) - 25 }}
        >
          Today
        </Text>
        {mode === 'pace' ? (
          <Text variant="smallest" className="absolute text-muted" style={{ right: 0 }}>
            {`${days} ${monthShort}`}
          </Text>
        ) : null}
      </View>
    </View>
  );
}
