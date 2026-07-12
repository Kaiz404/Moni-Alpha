import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  UIManager,
  View,
  useWindowDimensions,
} from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useFocusEffect, useRouter } from 'expo-router';
import MapView, { Marker } from 'react-native-maps';
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

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTransactionPinmap, type TransactionPinPoint } from '@/hooks/use-transaction-heatmap';
import { MoniFinanceAssistantSection } from '@/components/moni-finance-assistant-section';
import {
  computeFinanceAssistantInputHash,
  runFinanceAssistant,
} from '@/lib/ai/insights/finance-assistant';
import type { TxForMetrics } from '@/lib/ai/insights/insight-metrics';
import { getCategoryNameRows } from '@/lib/supabase/categories';
import {
  AI_INSIGHT_CONTEXT_GLOBAL,
  AI_INSIGHT_FEATURE_MONI_FINANCE_ASSISTANT,
  getAiInsightSlot,
  upsertAiInsight,
} from '@/lib/supabase/ai-insights';
import { getCategoryBudgets } from '@/lib/supabase/category-budgets';
import { getTransactions } from '@/lib/supabase/transactions';
import { getWallets } from '@/lib/supabase/wallets';
import type { MoniFinanceAssistantV1 } from '@repo/types';

type TransactionItem = {
  id: string;
  walletId: string;
  transferToWalletId?: string | null;
  amount: number;
  type: 'income' | 'expense' | 'transfer';
  categoryId?: string | null;
  merchant?: string | null;
  transactionDate: string;
};

type WalletItem = {
  id: string;
  name: string;
  color?: string | null;
  icon?: string | null;
  currency?: string | null;
  initialBalance?: number;
  currentBalance?: number;
};

const WALLET_ACCENT_COLORS = ['#0a7ea4', '#3b82f6', '#6366f1', '#8b5cf6', '#ec4899', '#f59e0b'];

export default function SummaryScreen() {
  const colorScheme = useColorScheme();
  const { width, height } = useWindowDimensions();
  const isDark = colorScheme === 'dark';
  /** Full width inside ScrollView (p-16) + card (p-3 × 2). Charts were ~40% width and looked left-aligned. */
  const chartWidth = useMemo(() => {
    const scrollHorizontal = 32;
    const cardHorizontal = 24;
    return Math.max(width - scrollHorizontal - cardHorizontal, 260);
  }, [width]);
  const hasSvgViewManager = useMemo(() => {
    if (Platform.OS !== 'android') return true;
    const getConfig = UIManager.getViewManagerConfig?.bind(UIManager);
    if (!getConfig) return false;
    return Boolean(getConfig('RNSVGRect') || getConfig('RCTRNSVGRect'));
  }, []);
  const { pinPoints, mapRegion, isLoading: pinmapLoading, error: pinmapError } = useTransactionPinmap();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<TransactionItem[]>([]);
  const [wallets, setWallets] = useState<WalletItem[]>([]);
  const [categoryMap, setCategoryMap] = useState<Record<string, string>>({});
  const [selectedPin, setSelectedPin] = useState<TransactionPinPoint | null>(null);

  const [financeInsight, setFinanceInsight] = useState<MoniFinanceAssistantV1 | null>(null);
  const [budgetRows, setBudgetRows] = useState<{ categoryId: string; amount: number }[]>([]);
  const [storedInsightHash, setStoredInsightHash] = useState<string | null>(null);
  const [liveInputHash, setLiveInputHash] = useState<string | null>(null);
  const [insightGenerating, setInsightGenerating] = useState(false);
  const [insightError, setInsightError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [txData, walletData, categoryRows, budgets] = await Promise.all([
        getTransactions(undefined, 8000),
        getWallets(),
        getCategoryNameRows(),
        getCategoryBudgets(),
      ]);

      setTransactions(txData as TransactionItem[]);
      setWallets(walletData as WalletItem[]);
      setCategoryMap(
        Object.fromEntries(
          categoryRows.map((row) => [row.id, row.name ?? 'Uncategorized'])
        )
      );
      setBudgetRows(budgets.map((b) => ({ categoryId: b.categoryId, amount: b.amount })));

      const row = await getAiInsightSlot(AI_INSIGHT_FEATURE_MONI_FINANCE_ASSISTANT, AI_INSIGHT_CONTEXT_GLOBAL);
      if (row?.status === 'ready' && row.result?.schema === 'moni_finance_assistant_v1') {
        setFinanceInsight(row.result);
        setStoredInsightHash(row.inputHash);
      } else if (!row) {
        setFinanceInsight(null);
        setStoredInsightHash(null);
      } else {
        // Keep showing the last successful run; only replace when user taps Regenerate or DB has a ready row.
        setStoredInsightHash(row.inputHash ?? null);
      }
    } catch (e) {
      console.error('Error loading summary data:', e);
      setError(e instanceof Error ? e.message : 'Failed to load summary data');
    } finally {
      setLoading(false);
    }
  }, []);

  const currencyHint = useMemo(
    () => wallets[0]?.currency?.trim() || 'USD',
    [wallets],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!transactions.length && !wallets.length) {
        setLiveInputHash(null);
        return;
      }
      const txs: TxForMetrics[] = transactions.map((t) => ({
        amount: t.amount,
        type: t.type,
        categoryId: t.categoryId,
        merchant: t.merchant ?? null,
        transactionDate: t.transactionDate,
      }));
      const { inputHash } = await computeFinanceAssistantInputHash(txs, categoryMap, budgetRows, currencyHint);
      if (!cancelled) setLiveInputHash(inputHash);
    })();
    return () => {
      cancelled = true;
    };
  }, [transactions, categoryMap, currencyHint, wallets.length, budgetRows]);

  const insightStale =
    storedInsightHash != null &&
    liveInputHash != null &&
    storedInsightHash !== liveInputHash;

  const generateInsights = useCallback(async () => {
    setInsightError(null);
    setInsightGenerating(true);
    try {
      const txs: TxForMetrics[] = transactions.map((t) => ({
        amount: t.amount,
        type: t.type,
        categoryId: t.categoryId,
        merchant: t.merchant ?? null,
        transactionDate: t.transactionDate,
      }));
      const out = await runFinanceAssistant(txs, categoryMap, budgetRows, currencyHint);
      setFinanceInsight(out.result);
      setStoredInsightHash(out.inputHash);
      await upsertAiInsight({
        featureKey: AI_INSIGHT_FEATURE_MONI_FINANCE_ASSISTANT,
        contextKey: AI_INSIGHT_CONTEXT_GLOBAL,
        inputHash: out.inputHash,
        status: 'ready',
        toolSnapshot: out.snapshot,
        result: out.result,
        errorMessage: null,
        modelId: out.trace.modelId,
      });
    } catch (e) {
      setInsightError(e instanceof Error ? e.message : 'Could not generate insights');
    } finally {
      setInsightGenerating(false);
    }
  }, [transactions, categoryMap, currencyHint, budgetRows]);

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
      else if (tx.type === 'expense') deltaByDay[key] -= tx.amount;
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


  const chartTheme = useMemo(() => VictoryTheme.material, []);
  const pieColorScale = ["#0a7ea4", "#3b82f6", "#6366f1", "#8b5cf6", "#ec4899", "#f59e0b"];

  const pieLegendData = useMemo(() => {
    const total = pieData.reduce((s, p) => s + (p.y || 0), 0) || 1;
    return (pieData.length ? pieData : [{ x: 'No expenses', y: 1 }]).slice(0, 6).map((item, index) => ({
      name: `${item.x} (${Math.round((item.y / total) * 100)}%)`,
      symbol: { fill: pieColorScale[index % pieColorScale.length] },
    }));
  }, [pieData]);

  const usageBarWidth = useMemo(() => {
    const count = Math.max(1, usageBarData.length);
    // approx 60% of the available slot per bar, clamp for large/small screens
    const approx = Math.floor((chartWidth / count) * 0.4);
    // cap max width lower to avoid very wide bars on tablets
    return Math.max(6, Math.min(36, approx));
  }, [usageBarData.length, chartWidth]);

  const usageDomainPaddingX = useMemo(() => Math.max(20, Math.floor(chartWidth / Math.max(usageBarData.length || 1, 1) * 0.08)), [usageBarData.length, chartWidth]);

  // Add an extra left-domain padding derived from half the bar width so the first bar
  // doesn't butt up against the Y axis. This is used to set asymmetric domainPadding.x
  const leftDomainExtra = useMemo(() => Math.ceil(usageBarWidth / 2) + 8, [usageBarWidth]);

  // Responsive chart dimensions based on device size
  const pieHeight = useMemo(() => {
    const base = Math.round(Math.min(420, Math.max(240, chartWidth * 0.66)));
    // don't exceed half device height
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

  const usageBottomPadding = useMemo(() => Math.max(52, Math.round(usageChartHeight * 0.18)), [usageChartHeight]);

  const pieInnerRadius = Math.max(36, Math.round(chartWidth * 0.12));

  const walletRows = useMemo(() => {
    return wallets.map((w, index) => ({
      wallet: w,
      balance: w.currentBalance ?? w.initialBalance ?? 0,
      dotColor: w.color?.trim() || WALLET_ACCENT_COLORS[index % WALLET_ACCENT_COLORS.length],
    }));
  }, [wallets]);

  const totalWalletBalance = useMemo(
    () => walletRows.reduce((sum, row) => sum + row.balance, 0),
    [walletRows]
  );

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
      <View className="flex-row items-center mb-4 pt-4">
        <View className="w-9 h-9 rounded-xl bg-slate-200 dark:bg-slate-700 items-center justify-center">
          <MaterialIcons name="bar-chart" size={20} color={isDark ? '#f1f5f9' : '#334155'} />
        </View>
        <Text className="text-2xl ml-3 font-bold text-gray-900 dark:text-white">Summary</Text>
      </View>

      <View className="rounded-2xl overflow-hidden mb-4 border border-[#8494FF]/25 dark:border-indigo-500/35 shadow-sm">
        <View className="bg-[#8494FF] dark:bg-[#4f54c4] px-4 py-3">
          <Text className="text-xs font-semibold uppercase tracking-[0.06em] text-white/90">Wallet balances</Text>
          <Text className="mt-1 text-2xl font-bold text-[#FAFAFA]">
            ${totalWalletBalance.toFixed(2)}
          </Text>
          <Text className="text-xs text-[#FAFAFA]/80">
            {wallets.length === 0
              ? 'Add wallets to see your total here'
              : wallets.length === 1
                ? 'Total across 1 wallet'
                : `Total across ${wallets.length} wallets`}
          </Text>
        </View>
        <View className="bg-[#FAFAFA] dark:bg-slate-900/90 px-3 py-1">
          {walletRows.length === 0 ? (
            <View className="py-6 px-2">
              <Text className="text-center text-sm text-slate-500 dark:text-slate-400">
                No wallets yet. Add a wallet from the Wallets tab to see balances here.
              </Text>
            </View>
          ) : (
            walletRows.map(({ wallet, balance, dotColor }, index) => (
              <View
                key={wallet.id}
                className={`flex-row items-center justify-between py-3 px-1 ${
                  index < walletRows.length - 1 ? 'border-b border-slate-200/90 dark:border-slate-600/80' : ''
                }`}
              >
                <View className="flex-row items-center flex-1 min-w-0 pr-2">
                  <View
                    className="w-2.5 h-2.5 rounded-full mr-3"
                    style={{ backgroundColor: dotColor }}
                  />
                  <View className="flex-1 min-w-0">
                    <Text className="text-base font-semibold text-slate-900 dark:text-white" numberOfLines={1}>
                      {wallet.name}
                    </Text>
                    <Text className="text-xs text-slate-500 dark:text-slate-400">
                      {wallet.currency?.trim() || 'USD'}
                    </Text>
                  </View>
                </View>
                <Text
                  className={`text-base font-bold shrink-0 ${
                    balance < 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-900 dark:text-white'
                  }`}
                >
                  ${balance.toFixed(2)}
                </Text>
              </View>
            ))
          )}
        </View>
      </View>

      <MoniFinanceAssistantSection
        insight={financeInsight}
        generating={insightGenerating}
        stale={insightStale}
        errorMessage={insightError}
        onRegenerate={generateInsights}
        disabled={loading}
        hasBudgetsConfigured={budgetRows.length > 0}
        onManageBudgets={() => router.push('/budget/budgets')}
      />

      <View className="rounded-xl bg-gray-100 dark:bg-gray-800 p-3 mb-4">
        <Text className="text-base font-semibold text-gray-900 dark:text-white mb-2">Transaction Pinmap</Text>
        {pinmapLoading ? (
          <View className="h-56 items-center justify-center">
            <ActivityIndicator size="large" color={Colors[colorScheme ?? 'light'].tint} />
            <Text className="mt-2 text-gray-600 dark:text-gray-300">Loading map pins...</Text>
          </View>
        ) : pinmapError ? (
          <View className="h-56 items-center justify-center px-3">
            <Text className="text-center text-red-500">{pinmapError}</Text>
          </View>
        ) : pinPoints.length === 0 ? (
          <View className="h-56 items-center justify-center px-3">
            <Text className="text-center text-gray-600 dark:text-gray-300">No transaction locations available yet.</Text>
          </View>
        ) : (
          <>
            <View style={styles.mapContainer}>
              <MapView
                style={styles.map}
                initialRegion={mapRegion}
                provider="google"
                onPress={() => router.push('/heatmap')}
              >
                {pinPoints.map((point, index) => (
                  <Marker
                    key={`${point.latitude}-${point.longitude}-${index}`}
                    coordinate={{ latitude: point.latitude, longitude: point.longitude }}
                    pinColor={'#1e88e5'}
                  />
                ))}
              </MapView>
            </View>

            {selectedPin ? (
              <View className="mt-2 rounded-lg bg-white dark:bg-gray-700 p-2">
                <Text className="text-sm font-semibold text-gray-900 dark:text-white">{selectedPin.locationName}</Text>
                <Text className="text-xs text-gray-700 dark:text-gray-200">{selectedPin.transactionCount} transaction(s)</Text>
                <Text className="text-xs text-gray-700 dark:text-gray-200">Amount: ${selectedPin.amount.toFixed(2)}</Text>
                <Text className="text-xs text-gray-500 dark:text-gray-300">{selectedPin.description}</Text>
              </View>
            ) : null}
          </>
        )}
      </View>

      <View className="rounded-xl bg-gray-100 dark:bg-gray-800 p-3 mb-4 items-center">
        <Text className="text-base font-semibold text-gray-900 dark:text-white mb-2 self-stretch">Expense Categories Contribution</Text>
          <VictoryPie
            theme={chartTheme}
            width={chartWidth}
            height={pieHeight}
            data={pieData.length ? pieData : [{ x: 'No expenses', y: 1 }]}
            colorScale={pieColorScale}
            // render as donut and avoid in-slice labels to prevent overlap on small areas
            innerRadius={pieInnerRadius}
            padAngle={2}
            labels={() => ''}
            style={{ labels: { fill: isDark ? '#f3f4f6' : '#111827', fontSize: 10, padding: 4 } }}
          />
          <VictoryLegend
            width={chartWidth}
            height={78}
            orientation="horizontal"
            gutter={12}
            itemsPerRow={2}
            data={pieLegendData}
            style={{ labels: { fill: isDark ? '#d1d5db' : '#374151', fontSize: 11 } }}
          />
      </View>

        <View className="rounded-xl bg-gray-100 dark:bg-gray-800 p-3 mb-4 items-center">
          <Text className="text-base font-semibold text-gray-900 dark:text-white mb-2 self-stretch">Total Wallet Value Over Time</Text>
          <View style={{ position: 'relative', alignSelf: 'stretch' }}>
            {/* Use explicit padding so we can compute plot area offsets reliably */}
            <VictoryChart
              theme={chartTheme}
              width={chartWidth}
              height={lineChartHeight}
              // increase left padding so Y-axis label sits clear of tick values on large screens
              padding={{ top: 10, bottom: 50, left: Math.max(56, Math.round(width * 0.06)), right: 20 }}
              scale={{ x: 'time', y: 'linear' }}
              domainPadding={{ x: 8, y: 12 }}
            >
              <VictoryAxis
                label="Date"
                tickFormat={(tick) => `${new Date(tick).getMonth() + 1}/${new Date(tick).getDate()}`}
                style={{
                  tickLabels: { fill: isDark ? '#d1d5db' : '#374151', fontSize: 10 },
                  axisLabel: { fill: isDark ? '#d1d5db' : '#374151', fontSize: 11, padding: 28 },
                }}
              />
              <VictoryAxis
                dependentAxis
                label="Total Value ($)"
                tickFormat={(tick) => `$${Number(tick).toFixed(0)}`}
                style={{
                  tickLabels: { fill: isDark ? '#d1d5db' : '#374151', fontSize: 10 },
                  // move axis label further left so it doesn't overlap numeric ticks
                  axisLabel: { fill: isDark ? '#d1d5db' : '#374151', fontSize: 11, padding: 56 },
                }}
              />
              <VictoryLine
                data={lineData}
                style={{ data: { stroke: '#0a7ea4', strokeWidth: 3 } }}
              />
              <VictoryScatter
                data={lineData}
                size={4}
                style={{ data: { fill: '#0a7ea4' } }}
              />
            </VictoryChart>
          </View>
        </View>

      <View className="rounded-xl bg-gray-100 dark:bg-gray-800 p-3 items-center">
        <Text className="text-base font-semibold text-gray-900 dark:text-white mb-2 self-stretch"># of Transactions Involved</Text>
        <VictoryChart
          theme={chartTheme}
          width={chartWidth}
          height={usageChartHeight}
          // balanced but reduced left/right padding so the plotted area has more room
          padding={{ top: 10, bottom: usageBottomPadding, left: 56, right: 48 }}
          // apply extra left domain padding equal to half a bar + offset
          domainPadding={{ x: [usageDomainPaddingX + leftDomainExtra, usageDomainPaddingX], y: 12 }}
          // ensure headroom so bars don't clash with axis/labels
          domain={{ y: [0, Math.max(5, Math.ceil((usageBarData.reduce((m, d) => Math.max(m, d.y), 0) || 1) * 1.08))] }}
        >
          <VictoryAxis
            style={{
              // force tick labels to match wallet names and keep them readable on wide screens
              tickLabels: { fill: isDark ? '#d1d5db' : '#374151', fontSize: 11, angle: -25, padding: 12 },
              axisLabel: { fill: isDark ? '#d1d5db' : '#374151', fontSize: 11, padding: 36 },
              grid: { stroke: 'transparent' },
            }}
            tickValues={usageBarData.map((d) => d.x)}
            tickFormat={usageBarData.map((d) => d.x)}
          />
          <VictoryAxis
            dependentAxis
            label="Transaction Count"
            style={{
              tickLabels: { fill: isDark ? '#d1d5db' : '#374151', fontSize: 10 },
              axisLabel: { fill: isDark ? '#d1d5db' : '#374151', fontSize: 11, padding: 42 },
              grid: { stroke: 'transparent' },
            }}
          />
          <VictoryBar
            data={usageBarData.length ? usageBarData : [{ x: 'No wallets', y: 0 }]}
            style={{ data: { fill: '#0a7ea4' } }}
            barWidth={usageBarWidth}
          />
        </VictoryChart>
        {/* Selection UI removed for visual-only mode */}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  mapContainer: {
    height: 240,
    borderRadius: 12,
    overflow: 'hidden',
  },
  map: {
    flex: 1,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  tooltip: {
    position: 'absolute',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#ffffff',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  tooltipArrow: {
    position: 'absolute',
    bottom: -6,
    left: '50%',
    marginLeft: -6,
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 6,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#ffffff',
  },
});

