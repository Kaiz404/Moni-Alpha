import { Text, View } from 'react-native';

import { DonutChart } from '@/components/charts/donut-chart';
import { LineChart } from '@/components/charts/line-chart';
import { Surface } from '@/components/ui/surface';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import {
  formatMinorAmount,
  minorToNumber,
  type CurrencyCode,
} from '@/lib/finance/money';
import type {
  CategoryExpense,
  CurrencyLine,
} from '@/lib/finance/selectors';

type CategoryExpenseChartProps = {
  currency: string;
  entries: CategoryExpense[];
  chartWidth: number;
};

/** Compatibility composition used by legacy callers; charts are SVG-only. */
export function CategoryExpenseChart({
  currency,
  entries,
}: CategoryExpenseChartProps) {
  const tokens = useThemeTokens();
  return (
    <Surface className="mb-4 p-4">
      <Text className="text-base font-semibold text-foreground">
        Expense categories · {currency}
      </Text>
      <View className="mt-2">
        <DonutChart
          data={entries.map((entry, index) => ({
            id: entry.categoryId ?? `uncategorized-${index}`,
            label: entry.name,
            value: minorToNumber(entry.yMinor),
            color: entry.color,
            icon: entry.icon,
          }))}
          colors={tokens.chart}
          surfaceColor={tokens.card}
          mutedColor={tokens.muted}
          valueLabel={(value) =>
            formatMinorAmount(
              Math.round(value * 100),
              currency as CurrencyCode,
            )
          }
        />
      </View>
    </Surface>
  );
}

type BalanceLineChartProps = {
  line: CurrencyLine;
  chartWidth: number;
};

/** Compatibility trend used by legacy callers; selection is handled by LineChart. */
export function BalanceLineChart({
  line,
  chartWidth,
}: BalanceLineChartProps) {
  const tokens = useThemeTokens();
  return (
    <Surface className="mb-4 p-4">
      <Text className="text-base font-semibold text-foreground">
        Balance over time · {line.currency}
      </Text>
      <View className="mt-3">
        <LineChart
          data={line.points.map((point, index) => ({
            id: `${point.x.toISOString()}-${index}`,
            date: point.x,
            value: minorToNumber(point.yMinor),
          }))}
          width={chartWidth}
          strokeColor={tokens.primary}
          gridColor={tokens.surface2}
          surfaceColor={tokens.card}
          valueLabel={(value) =>
            formatMinorAmount(
              Math.round(value * 100),
              line.currency as CurrencyCode,
            )
          }
          dateLabel={(date) =>
            new Intl.DateTimeFormat(undefined, {
              month: 'short',
              day: 'numeric',
            }).format(date)
          }
        />
      </View>
    </Surface>
  );
}
