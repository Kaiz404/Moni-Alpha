import { useMemo } from 'react';
import { Text, View } from 'react-native';
import {
  VictoryAxis,
  VictoryChart,
  VictoryLegend,
  VictoryLine,
  VictoryPie,
  VictoryTheme,
} from 'victory-native';
import type { MinorAmount } from '@/lib/finance/money';

import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { minorToNumber } from '@/lib/finance/money';
import type { CurrencyLine } from '@/lib/finance/selectors';

type CategoryExpenseChartProps = {
  currency: string;
  entries: { x: string; yMinor: MinorAmount }[];
  chartWidth: number;
};

export function CategoryExpenseChart({
  currency,
  entries,
  chartWidth,
}: CategoryExpenseChartProps) {
  const tokens = useThemeTokens();
  const chartTheme = useMemo(() => VictoryTheme.material, []);
  const data = entries.map(({ x, yMinor }) => ({
    x,
    y: minorToNumber(yMinor),
  }));
  const chartData = data.length ? data : [{ x: 'No expenses', y: 1 }];
  const total = data.reduce((sum, item) => sum + item.y, 0) || 1;

  return (
    <View className="mb-4 items-center rounded-2xl border border-border bg-card p-3">
      <Text className="mb-2 self-stretch text-base font-semibold text-foreground">
        Expense categories · {currency}
      </Text>
      <VictoryPie
        theme={chartTheme}
        width={chartWidth}
        height={260}
        data={chartData}
        colorScale={[...tokens.chart]}
        innerRadius={44}
        padAngle={2}
        labels={() => ''}
      />
      <VictoryLegend
        width={chartWidth}
        height={72}
        orientation="horizontal"
        itemsPerRow={2}
        gutter={12}
        data={chartData.slice(0, 6).map((item, index) => ({
          name: `${item.x} (${Math.round((item.y / total) * 100)}%)`,
          symbol: { fill: tokens.chart[index % tokens.chart.length] },
        }))}
        style={{ labels: { fill: tokens.muted, fontSize: 11 } }}
      />
    </View>
  );
}

type BalanceLineChartProps = {
  line: CurrencyLine;
  chartWidth: number;
};

export function BalanceLineChart({
  line,
  chartWidth,
}: BalanceLineChartProps) {
  const tokens = useThemeTokens();
  const chartTheme = useMemo(() => VictoryTheme.material, []);
  const { currency, points } = line;

  return (
    <View className="mb-4 rounded-2xl border border-border bg-card p-3">
      <Text className="mb-2 text-base font-semibold text-foreground">
        Balance over time · {currency}
      </Text>
      <VictoryChart
        theme={chartTheme}
        width={chartWidth}
        height={260}
        padding={{ top: 12, bottom: 45, left: 62, right: 20 }}
        scale={{ x: 'time', y: 'linear' }}
      >
        <VictoryAxis
          tickFormat={(tick) =>
            `${new Date(tick).getMonth() + 1}/${new Date(tick).getDate()}`
          }
          style={{ tickLabels: { fill: tokens.muted, fontSize: 10 } }}
        />
        <VictoryAxis
          dependentAxis
          tickFormat={(tick) =>
            `${currency} ${Number(tick).toFixed(0)}`
          }
          style={{ tickLabels: { fill: tokens.muted, fontSize: 9 } }}
        />
        <VictoryLine
          data={points.map((point) => ({
            x: point.x,
            y: minorToNumber(point.yMinor),
          }))}
          style={{ data: { stroke: tokens.primary, strokeWidth: 3 } }}
        />
      </VictoryChart>
    </View>
  );
}
