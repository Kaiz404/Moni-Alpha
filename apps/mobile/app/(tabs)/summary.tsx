import { useMemo } from 'react';
import { Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import { useValue } from '@legendapp/state/react';
import { VictoryAxis, VictoryChart, VictoryLegend, VictoryLine, VictoryPie, VictoryTheme } from 'victory-native';
import { useAuth } from '@/lib/auth/auth-context';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { formatMinorAmount, minorToNumber } from '@/lib/finance/money';
import { financeOverview$, netWorthByCurrency$ } from '@/lib/finance/selectors';

export default function SummaryScreen() {
  const { user } = useAuth();
  const tokens = useThemeTokens();
  const { width } = useWindowDimensions();
  const chartWidth = Math.max(width - 48, 280);
  const overview = useValue(financeOverview$(user?.id ?? null));
  const netWorth = useValue(netWorthByCurrency$(user?.id ?? null));
  const chartTheme = useMemo(() => VictoryTheme.material, []);
  return (
    <ScrollView className="flex-1 bg-background" contentContainerClassName="p-4 pb-12" showsVerticalScrollIndicator={false}>
      <Text className="mb-4 pt-4 text-2xl font-bold text-foreground">Summary</Text>
      <View className="mb-4 rounded-2xl border border-border bg-card p-4">
        <Text className="text-base font-semibold text-foreground">Cash and net worth</Text>
        <Text className="mt-1 text-xs text-muted">Amounts remain separated by currency. Debt cash activity is excluded from spending.</Text>
        {netWorth.length === 0 ? <Text className="mt-4 text-sm text-muted">Add a wallet to see your finances here.</Text> : netWorth.map((row) => <View key={row.currency} className="mt-3 border-t border-border pt-3"><View className="flex-row justify-between"><Text className="font-semibold text-foreground">{row.currency}</Text><Text className="font-bold text-foreground">{formatMinorAmount(row.netWorthMinor, row.currency)}</Text></View><Text className="mt-1 text-xs text-muted">Cash {formatMinorAmount(row.cashMinor, row.currency)} · Owed to you {formatMinorAmount(row.receivableMinor, row.currency)} · You owe {formatMinorAmount(row.payableMinor, row.currency)}</Text></View>)}
      </View>
      <View className="mb-4 rounded-2xl border border-border bg-card p-4">
        <Text className="text-base font-semibold text-foreground">Wallet balances</Text>
        {overview.wallets.map((wallet) => <View key={wallet.id} className="mt-3 flex-row items-center justify-between"><View><Text className="font-semibold text-foreground">{wallet.name}</Text><Text className="text-xs text-muted">{wallet.currency}</Text></View><Text className="font-bold text-foreground">{formatMinorAmount(overview.balancesByWallet[wallet.id] ?? 0, wallet.currency)}</Text></View>)}
      </View>
      <Pressable className="mb-4 rounded-2xl border border-border bg-card p-4" onPress={() => router.push('/heatmap' as any)}><Text className="text-base font-semibold text-foreground">Transaction pinmap</Text><Text className="mt-1 text-sm text-muted">Open locations and currency-separated transaction amounts.</Text></Pressable>
      {Object.entries(overview.categoryExpensesByCurrency).map(([currency, entries]) => {
        const data = entries.map(({ x, yMinor }) => ({ x, y: minorToNumber(yMinor) }));
        const total = data.reduce((sum, item) => sum + item.y, 0) || 1;
        return <View key={currency} className="mb-4 items-center rounded-2xl border border-border bg-card p-3"><Text className="mb-2 self-stretch text-base font-semibold text-foreground">Expense categories · {currency}</Text><VictoryPie theme={chartTheme} width={chartWidth} height={260} data={data.length ? data : [{ x: 'No expenses', y: 1 }]} colorScale={[...tokens.chart]} innerRadius={44} padAngle={2} labels={() => ''} /><VictoryLegend width={chartWidth} height={72} orientation="horizontal" itemsPerRow={2} gutter={12} data={(data.length ? data : [{ x: 'No expenses', y: 1 }]).slice(0, 6).map((item, index) => ({ name: `${item.x} (${Math.round((item.y / total) * 100)}%)`, symbol: { fill: tokens.chart[index % tokens.chart.length] } }))} style={{ labels: { fill: tokens.muted, fontSize: 11 } }} /></View>;
      })}
      {overview.balanceLines.map(({ currency, points }) => <View key={currency} className="mb-4 rounded-2xl border border-border bg-card p-3"><Text className="mb-2 text-base font-semibold text-foreground">Balance over time · {currency}</Text><VictoryChart theme={chartTheme} width={chartWidth} height={260} padding={{ top: 12, bottom: 45, left: 62, right: 20 }} scale={{ x: 'time', y: 'linear' }}><VictoryAxis tickFormat={(tick) => `${new Date(tick).getMonth() + 1}/${new Date(tick).getDate()}`} style={{ tickLabels: { fill: tokens.muted, fontSize: 10 } }} /><VictoryAxis dependentAxis tickFormat={(tick) => `${currency} ${Number(tick).toFixed(0)}`} style={{ tickLabels: { fill: tokens.muted, fontSize: 9 } }} /><VictoryLine data={points.map((point) => ({ x: point.x, y: minorToNumber(point.yMinor) }))} style={{ data: { stroke: tokens.primary, strokeWidth: 3 } }} /></VictoryChart></View>)}
    </ScrollView>
  );
}
