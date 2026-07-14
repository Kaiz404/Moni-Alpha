import { useMemo } from 'react';
import { Text, View, useWindowDimensions } from 'react-native';
import {
  VictoryAxis,
  VictoryBar,
  VictoryChart,
  VictoryLegend,
  VictoryLine,
  VictoryPie,
  VictoryScatter,
  VictoryTheme,
} from 'victory-native';

import { useThemeTokens } from '@/hooks/use-theme-tokens';
import type { ChartPoint } from '@/lib/summary/aggregates';

type SummaryChartsProps = {
  pieData: ChartPoint[];
  lineData: ChartPoint[];
  usageBarData: ChartPoint[];
  chartWidth: number;
};

export function SummaryCharts({ pieData, lineData, usageBarData, chartWidth }: SummaryChartsProps) {
  const tokens = useThemeTokens();
  const { width, height } = useWindowDimensions();

  const chartTheme = useMemo(() => VictoryTheme.material, []);
  const pieColorScale = useMemo(() => [...tokens.chart], [tokens.chart]);

  const pieLegendData = useMemo(() => {
    const total = pieData.reduce((s, p) => s + (p.y || 0), 0) || 1;
    return (pieData.length ? pieData : [{ x: 'No expenses', y: 1 }]).slice(0, 6).map((item, index) => ({
      name: `${item.x} (${Math.round((item.y / total) * 100)}%)`,
      symbol: { fill: pieColorScale[index % pieColorScale.length] },
    }));
  }, [pieData, pieColorScale]);

  const usageBarWidth = useMemo(() => {
    const count = Math.max(1, usageBarData.length);
    const approx = Math.floor((chartWidth / count) * 0.4);
    return Math.max(6, Math.min(36, approx));
  }, [usageBarData.length, chartWidth]);

  const usageDomainPaddingX = useMemo(
    () => Math.max(20, Math.floor((chartWidth / Math.max(usageBarData.length || 1, 1)) * 0.08)),
    [usageBarData.length, chartWidth],
  );

  const leftDomainExtra = useMemo(() => Math.ceil(usageBarWidth / 2) + 8, [usageBarWidth]);

  const pieHeight = useMemo(() => {
    const base = Math.round(Math.min(420, Math.max(240, chartWidth * 0.66)));
    return Math.min(base, Math.round(height * 0.48));
  }, [chartWidth, height]);

  const lineChartHeight = useMemo(() => {
    const base = Math.round(Math.min(360, Math.max(220, chartWidth * 0.56)));
    return Math.min(base, Math.round(height * 0.45));
  }, [chartWidth, height]);

  const usageChartHeight = useMemo(() => {
    const base = Math.round(Math.min(380, Math.max(220, chartWidth * 0.46)));
    return Math.min(base, Math.round(height * 0.44));
  }, [chartWidth, height]);

  const usageBottomPadding = useMemo(
    () => Math.max(52, Math.round(usageChartHeight * 0.18)),
    [usageChartHeight],
  );

  const pieInnerRadius = Math.max(36, Math.round(chartWidth * 0.12));

  return (
    <>
      <View className="mb-4 items-center rounded-2xl border border-border bg-card p-3">
        <Text className="mb-2 self-stretch text-base font-semibold text-foreground">
          Expense Categories Contribution
        </Text>
        <VictoryPie
          theme={chartTheme}
          width={chartWidth}
          height={pieHeight}
          data={pieData.length ? pieData : [{ x: 'No expenses', y: 1 }]}
          colorScale={pieColorScale}
          innerRadius={pieInnerRadius}
          padAngle={2}
          labels={() => ''}
          style={{ labels: { fill: tokens.foreground, fontSize: 10, padding: 4 } }}
        />
        <VictoryLegend
          width={chartWidth}
          height={78}
          orientation="horizontal"
          gutter={12}
          itemsPerRow={2}
          data={pieLegendData}
          style={{ labels: { fill: tokens.muted, fontSize: 11 } }}
        />
      </View>

      <View className="mb-4 items-center rounded-2xl border border-border bg-card p-3">
        <Text className="mb-2 self-stretch text-base font-semibold text-foreground">
          Total Wallet Value Over Time
        </Text>
        <View style={{ position: 'relative', alignSelf: 'stretch' }}>
          <VictoryChart
            theme={chartTheme}
            width={chartWidth}
            height={lineChartHeight}
            padding={{ top: 10, bottom: 50, left: Math.max(56, Math.round(width * 0.06)), right: 20 }}
            scale={{ x: 'time', y: 'linear' }}
            domainPadding={{ x: 8, y: 12 }}
          >
            <VictoryAxis
              label="Date"
              tickFormat={(tick) => `${new Date(tick).getMonth() + 1}/${new Date(tick).getDate()}`}
              style={{
                tickLabels: { fill: tokens.muted, fontSize: 10 },
                axisLabel: { fill: tokens.muted, fontSize: 11, padding: 28 },
              }}
            />
            <VictoryAxis
              dependentAxis
              label="Total Value ($)"
              tickFormat={(tick) => `$${Number(tick).toFixed(0)}`}
              style={{
                tickLabels: { fill: tokens.muted, fontSize: 10 },
                axisLabel: { fill: tokens.muted, fontSize: 11, padding: 56 },
              }}
            />
            <VictoryLine data={lineData} style={{ data: { stroke: tokens.primary, strokeWidth: 3 } }} />
            <VictoryScatter data={lineData} size={4} style={{ data: { fill: tokens.primary } }} />
          </VictoryChart>
        </View>
      </View>

      <View className="items-center rounded-2xl border border-border bg-card p-3">
        <Text className="mb-2 self-stretch text-base font-semibold text-foreground">
          # of Transactions Involved
        </Text>
        <VictoryChart
          theme={chartTheme}
          width={chartWidth}
          height={usageChartHeight}
          padding={{ top: 10, bottom: usageBottomPadding, left: 56, right: 48 }}
          domainPadding={{ x: [usageDomainPaddingX + leftDomainExtra, usageDomainPaddingX], y: 12 }}
          domain={{
            y: [
              0,
              Math.max(
                5,
                Math.ceil((usageBarData.reduce((m, d) => Math.max(m, d.y), 0) || 1) * 1.08),
              ),
            ],
          }}
        >
          <VictoryAxis
            style={{
              tickLabels: { fill: tokens.muted, fontSize: 11, angle: -25, padding: 12 },
              axisLabel: { fill: tokens.muted, fontSize: 11, padding: 36 },
              grid: { stroke: 'transparent' },
            }}
            tickValues={usageBarData.map((d) => d.x)}
            tickFormat={usageBarData.map((d) => d.x)}
          />
          <VictoryAxis
            dependentAxis
            label="Transaction Count"
            style={{
              tickLabels: { fill: tokens.muted, fontSize: 10 },
              axisLabel: { fill: tokens.muted, fontSize: 11, padding: 42 },
              grid: { stroke: 'transparent' },
            }}
          />
          <VictoryBar
            data={usageBarData.length ? usageBarData : [{ x: 'No wallets', y: 0 }]}
            style={{ data: { fill: tokens.primary } }}
            barWidth={usageBarWidth}
          />
        </VictoryChart>
      </View>
    </>
  );
}
