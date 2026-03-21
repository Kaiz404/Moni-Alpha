import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Platform, ScrollView, Text, UIManager, View, useWindowDimensions } from 'react-native';
import { useFocusEffect } from 'expo-router';
import {
  VictoryAxis,
  VictoryBar,
  VictoryChart,
  VictoryLine,
  VictoryPie,
  VictoryScatter,
  VictoryTheme,
} from 'victory-native';

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { syncSystem } from '@/lib/powersync/Powersync';
import { getTransactions } from '@/lib/supabase/transactions';
import { getWallets } from '@/lib/supabase/wallets';

type TransactionItem = {
  id: string;
  walletId: string;
  transferToWalletId?: string | null;
  amount: number;
  type: 'income' | 'expense' | 'transfer';
  categoryId?: string | null;
  transactionDate: string;
};

type WalletItem = {
  id: string;
  name: string;
  color?: string | null;
  initialBalance?: number;
};

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const HEATMAP_WEEKS = 8;

const toDateOnly = (date: Date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

export default function SummaryScreen() {
  const colorScheme = useColorScheme();
  const { width } = useWindowDimensions();
  const isDark = colorScheme === 'dark';
  const chartWidth = Math.max(width - 48, 280);
  const hasSvgViewManager = useMemo(() => {
    if (Platform.OS !== 'android') return true;
    const getConfig = UIManager.getViewManagerConfig?.bind(UIManager);
    if (!getConfig) return false;
    return Boolean(getConfig('RNSVGRect') || getConfig('RCTRNSVGRect'));
  }, []);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<TransactionItem[]>([]);
  const [wallets, setWallets] = useState<WalletItem[]>([]);
  const [categoryMap, setCategoryMap] = useState<Record<string, string>>({});

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [txData, walletData, categoryRows] = await Promise.all([
        getTransactions(),
        getWallets(),
        syncSystem.db
          .selectFrom('categories')
          .select(['id', 'name'])
          .where('is_active', '=', 1)
          .execute(),
      ]);

      setTransactions(txData as TransactionItem[]);
      setWallets(walletData as WalletItem[]);
      setCategoryMap(
        Object.fromEntries(
          categoryRows.map((row) => [row.id, row.name ?? 'Uncategorized'])
        )
      );
    } catch (e) {
      console.error('Error loading summary data:', e);
      setError(e instanceof Error ? e.message : 'Failed to load summary data');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const pieData = useMemo(() => {
    const totals: Record<string, number> = {};

    transactions.forEach((tx) => {
      if (tx.type !== 'expense') return;

      const categoryName = tx.categoryId ? categoryMap[tx.categoryId] ?? 'Uncategorized' : 'Uncategorized';
      totals[categoryName] = (totals[categoryName] ?? 0) + tx.amount;
    });

    const entries = Object.entries(totals)
      .map(([x, y]) => ({ x, y }))
      .sort((a, b) => b.y - a.y);

    if (entries.length <= 6) return entries;

    const top = entries.slice(0, 5);
    const otherTotal = entries.slice(5).reduce((sum, current) => sum + current.y, 0);
    return [...top, { x: 'Other', y: otherTotal }];
  }, [transactions, categoryMap]);

  const lineData = useMemo(() => {
    const sorted = [...transactions].sort(
      (a, b) => new Date(a.transactionDate).getTime() - new Date(b.transactionDate).getTime()
    );

    const initialTotal = wallets.reduce((sum, wallet) => sum + (wallet.initialBalance ?? 0), 0);

    const deltaByDay: Record<string, number> = {};
    sorted.forEach((tx) => {
      const key = new Date(tx.transactionDate).toISOString().slice(0, 10);
      if (!deltaByDay[key]) {
        deltaByDay[key] = 0;
      }

      if (tx.type === 'income') deltaByDay[key] += tx.amount;
      if (tx.type === 'expense') deltaByDay[key] -= tx.amount;
    });

    const keys = Object.keys(deltaByDay).sort();
    if (!keys.length) {
      return [{ x: new Date(), y: initialTotal }];
    }

    let running = initialTotal;
    return keys.map((key) => {
      running += deltaByDay[key];
      return { x: new Date(key), y: Number(running.toFixed(2)) };
    });
  }, [transactions, wallets]);

  const usageBarData = useMemo(() => {
    const usage: Record<string, number> = Object.fromEntries(wallets.map((wallet) => [wallet.id, 0]));

    transactions.forEach((tx) => {
      usage[tx.walletId] = (usage[tx.walletId] ?? 0) + 1;
      if (tx.transferToWalletId) {
        usage[tx.transferToWalletId] = (usage[tx.transferToWalletId] ?? 0) + 1;
      }
    });

    return wallets
      .map((wallet) => ({
        x: wallet.name.length > 10 ? `${wallet.name.slice(0, 10)}…` : wallet.name,
        y: usage[wallet.id] ?? 0,
      }))
      .sort((a, b) => b.y - a.y);
  }, [transactions, wallets]);

  const heatmapData = useMemo(() => {
    const today = toDateOnly(new Date());
    const heat: Record<string, number> = {};

    transactions.forEach((tx) => {
      if (tx.type !== 'expense') return;
      const txDate = toDateOnly(new Date(tx.transactionDate));
      const diffDays = Math.floor((today.getTime() - txDate.getTime()) / (1000 * 60 * 60 * 24));
      const weekOffset = Math.floor(diffDays / 7);

      if (weekOffset < 0 || weekOffset >= HEATMAP_WEEKS) return;

      const weekIndex = HEATMAP_WEEKS - weekOffset;
      const weekday = WEEKDAY_LABELS[txDate.getDay()];
      const key = `${weekIndex}-${weekday}`;
      heat[key] = (heat[key] ?? 0) + tx.amount;
    });

    const points: Array<{ x: string; y: string; amount: number }> = [];
    for (let week = 1; week <= HEATMAP_WEEKS; week += 1) {
      for (const day of WEEKDAY_LABELS) {
        points.push({
          x: day,
          y: `W${week}`,
          amount: Number((heat[`${week}-${day}`] ?? 0).toFixed(2)),
        });
      }
    }

    return points;
  }, [transactions]);

  const chartTheme = useMemo(() => VictoryTheme.material, []);

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-white dark:bg-gray-900">
        <ActivityIndicator size="large" color={Colors[colorScheme ?? 'light'].tint} />
        <Text className="mt-3 text-gray-600 dark:text-gray-300">Loading summary...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View className="flex-1 items-center justify-center bg-white dark:bg-gray-900 px-4">
        <Text className="text-center text-red-500">{error}</Text>
      </View>
    );
  }

  if (!hasSvgViewManager) {
    return (
      <View className="flex-1 items-center justify-center bg-white dark:bg-gray-900 px-5">
        <Text className="text-center text-lg font-semibold text-gray-900 dark:text-white mb-2">Summary charts unavailable in this build</Text>
        <Text className="text-center text-sm text-gray-600 dark:text-gray-300 mb-1">Native SVG module is missing from your installed Android development client.</Text>
        <Text className="text-center text-sm text-gray-600 dark:text-gray-300">Reinstall a fresh dev build after dependency changes (`react-native-svg`) and reopen Summary.</Text>
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-white dark:bg-gray-900" contentContainerStyle={{ padding: 16, paddingBottom: 48 }}>
      <Text className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">Summary</Text>

      <View className="rounded-xl bg-gray-100 dark:bg-gray-800 p-3 mb-4">
        <Text className="text-base font-semibold text-gray-900 dark:text-white mb-2">Spending Heatmap (Last 8 Weeks)</Text>
        <VictoryChart
          theme={chartTheme}
          width={chartWidth}
          height={280}
          domainPadding={{ x: 12, y: 10 }}
        >
          <VictoryAxis style={{ tickLabels: { fill: isDark ? '#d1d5db' : '#374151', fontSize: 10 } }} />
          <VictoryAxis dependentAxis style={{ tickLabels: { fill: isDark ? '#d1d5db' : '#374151', fontSize: 10 } }} />
          <VictoryScatter
            data={heatmapData}
            x="x"
            y="y"
            size={10}
            symbol="square"
            style={{
              data: {
                fill: ({ datum }: any) =>
                  datum.amount > 0 ? '#0a7ea4' : isDark ? '#1f2937' : '#e5e7eb',
                stroke: isDark ? '#111827' : '#ffffff',
                strokeWidth: 1,
              },
            }}
          />
        </VictoryChart>
      </View>

      <View className="rounded-xl bg-gray-100 dark:bg-gray-800 p-3 mb-4">
        <Text className="text-base font-semibold text-gray-900 dark:text-white mb-2">Expense Categories Contribution</Text>
        <VictoryPie
          theme={chartTheme}
          width={chartWidth}
          height={300}
          data={pieData.length ? pieData : [{ x: 'No expenses', y: 1 }]}
          colorScale={["#0a7ea4", "#3b82f6", "#6366f1", "#8b5cf6", "#ec4899", "#f59e0b"]}
          labels={({ datum }: any) => `${datum.x}: ${Number(datum.y).toFixed(0)}`}
          style={{ labels: { fill: isDark ? '#f3f4f6' : '#111827', fontSize: 10 } }}
        />
      </View>

      <View className="rounded-xl bg-gray-100 dark:bg-gray-800 p-3 mb-4">
        <Text className="text-base font-semibold text-gray-900 dark:text-white mb-2">Total Wallet Value Over Time</Text>
        <VictoryChart
          theme={chartTheme}
          width={chartWidth}
          height={260}
          scale={{ x: 'time', y: 'linear' }}
          domainPadding={{ x: 8, y: 12 }}
        >
          <VictoryAxis
            tickFormat={(tick) => `${new Date(tick).getMonth() + 1}/${new Date(tick).getDate()}`}
            style={{ tickLabels: { fill: isDark ? '#d1d5db' : '#374151', fontSize: 10 } }}
          />
          <VictoryAxis
            dependentAxis
            tickFormat={(tick) => `$${Number(tick).toFixed(0)}`}
            style={{ tickLabels: { fill: isDark ? '#d1d5db' : '#374151', fontSize: 10 } }}
          />
          <VictoryLine
            data={lineData}
            style={{ data: { stroke: '#0a7ea4', strokeWidth: 3 } }}
          />
        </VictoryChart>
      </View>

      <View className="rounded-xl bg-gray-100 dark:bg-gray-800 p-3">
        <Text className="text-base font-semibold text-gray-900 dark:text-white mb-2">Wallet Usage (Transactions Involved)</Text>
        <VictoryChart
          theme={chartTheme}
          width={chartWidth}
          height={280}
          domainPadding={{ x: 20, y: 12 }}
        >
          <VictoryAxis style={{ tickLabels: { fill: isDark ? '#d1d5db' : '#374151', fontSize: 10, angle: -25 } }} />
          <VictoryAxis dependentAxis style={{ tickLabels: { fill: isDark ? '#d1d5db' : '#374151', fontSize: 10 } }} />
          <VictoryBar
            data={usageBarData.length ? usageBarData : [{ x: 'No wallets', y: 0 }]}
            style={{ data: { fill: '#0a7ea4' } }}
          />
        </VictoryChart>
      </View>
    </ScrollView>
  );
}
