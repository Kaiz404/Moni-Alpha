import { useCallback, useMemo, useState } from 'react';
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

import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { GradientCard } from '@/components/ui/gradient-card';
import { getWalletCardStyle } from '@/constants/wallet-card-styles';
import { useTransactionPinmap, type TransactionPinPoint } from '@/hooks/use-transaction-heatmap';
import { getCategoryNameRows } from '@/lib/supabase/categories';
import { getTransactions } from '@/lib/supabase/transactions';
import { getWallets } from '@/lib/supabase/wallets';

const balanceCardStyle = getWalletCardStyle('emerald-grain');

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

export default function SummaryScreen() {
  const tokens = useThemeTokens();
  const { width, height } = useWindowDimensions();
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
  const [selectedPin] = useState<TransactionPinPoint | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [txData, walletData, categoryRows] = await Promise.all([
        getTransactions(undefined, 8000),
        getWallets(),
        getCategoryNameRows(),
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
      dotColor: w.color?.trim() || tokens.chart[index % tokens.chart.length],
    }));
  }, [wallets, tokens.chart]);

  const totalWalletBalance = useMemo(
    () => walletRows.reduce((sum, row) => sum + row.balance, 0),
    [walletRows]
  );

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator size="large" color={tokens.primary} />
        <Text className="mt-3 text-muted">Loading summary...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View className="flex-1 items-center justify-center bg-background px-4">
        <Text className="text-center text-expense">{error}</Text>
      </View>
    );
  }

  if (!hasSvgViewManager) {
    return (
      <View className="flex-1 items-center justify-center bg-background px-5">
        <Text className="mb-2 text-center text-lg font-semibold text-foreground">Summary charts unavailable in this build</Text>
        <Text className="mb-1 text-center text-sm text-muted">Native SVG module is missing from your installed Android development client.</Text>
        <Text className="text-center text-sm text-muted">Reinstall a fresh dev build after dependency changes (`react-native-svg`) and reopen Summary.</Text>
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-background" contentContainerStyle={{ padding: 16, paddingBottom: 48 }}>
      <View className="mb-4 pt-4">
        <Text className="text-2xl font-bold text-foreground">Summary</Text>
      </View>

      <View className="mb-4 overflow-hidden rounded-3xl border border-border">
        <GradientCard cardStyle={balanceCardStyle} className="px-4 py-4">
          <Text className="text-xs font-semibold uppercase tracking-[0.06em] text-white/90">Wallet balances</Text>
          <Text className="mt-1 text-2xl font-bold text-white">
            ${totalWalletBalance.toFixed(2)}
          </Text>
          <Text className="text-xs text-white/80">
            {wallets.length === 0
              ? 'Add wallets to see your total here'
              : wallets.length === 1
                ? 'Total across 1 wallet'
                : `Total across ${wallets.length} wallets`}
          </Text>
        </GradientCard>
        <View className="bg-card px-3 py-1">
          {walletRows.length === 0 ? (
            <View className="py-6 px-2">
              <Text className="text-center text-sm text-muted">
                No wallets yet. Add a wallet from the Wallets tab to see balances here.
              </Text>
            </View>
          ) : (
            walletRows.map(({ wallet, balance, dotColor }, index) => (
              <View
                key={wallet.id}
                className={`flex-row items-center justify-between py-3 px-1 ${
                  index < walletRows.length - 1 ? 'border-b border-border' : ''
                }`}
              >
                <View className="flex-row items-center flex-1 min-w-0 pr-2">
                  <View
                    className="w-2.5 h-2.5 rounded-full mr-3"
                    style={{ backgroundColor: dotColor }}
                  />
                  <View className="flex-1 min-w-0">
                    <Text className="text-base font-semibold text-foreground" numberOfLines={1}>
                      {wallet.name}
                    </Text>
                    <Text className="text-xs text-muted">
                      {wallet.currency?.trim() || 'USD'}
                    </Text>
                  </View>
                </View>
                <Text
                  className={`text-base font-bold shrink-0 ${
                    balance < 0 ? 'text-expense' : 'text-foreground'
                  }`}
                >
                  ${balance.toFixed(2)}
                </Text>
              </View>
            ))
          )}
        </View>
      </View>

      <View className="mb-4 rounded-2xl border border-border bg-card p-3">
        <Text className="mb-2 text-base font-semibold text-foreground">Transaction Pinmap</Text>
        {pinmapLoading ? (
          <View className="h-56 items-center justify-center">
            <ActivityIndicator size="large" color={tokens.primary} />
            <Text className="mt-2 text-muted">Loading map pins...</Text>
          </View>
        ) : pinmapError ? (
          <View className="h-56 items-center justify-center px-3">
            <Text className="text-center text-expense">{pinmapError}</Text>
          </View>
        ) : pinPoints.length === 0 ? (
          <View className="h-56 items-center justify-center px-3">
            <Text className="text-center text-muted">No transaction locations available yet.</Text>
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
                    pinColor={tokens.primary}
                  />
                ))}
              </MapView>
            </View>

            {selectedPin ? (
              <View className="mt-2 rounded-lg bg-background p-2">
                <Text className="text-sm font-semibold text-foreground">{selectedPin.locationName}</Text>
                <Text className="text-xs text-foreground">{selectedPin.transactionCount} transaction(s)</Text>
                <Text className="text-xs text-foreground">Amount: ${selectedPin.amount.toFixed(2)}</Text>
                <Text className="text-xs text-muted">{selectedPin.description}</Text>
              </View>
            ) : null}
          </>
        )}
      </View>

      <View className="mb-4 items-center rounded-2xl border border-border bg-card p-3">
        <Text className="mb-2 self-stretch text-base font-semibold text-foreground">Expense Categories Contribution</Text>
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
          <Text className="mb-2 self-stretch text-base font-semibold text-foreground">Total Wallet Value Over Time</Text>
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
                  // move axis label further left so it doesn't overlap numeric ticks
                  axisLabel: { fill: tokens.muted, fontSize: 11, padding: 56 },
                }}
              />
              <VictoryLine
                data={lineData}
                style={{ data: { stroke: tokens.primary, strokeWidth: 3 } }}
              />
              <VictoryScatter
                data={lineData}
                size={4}
                style={{ data: { fill: tokens.primary } }}
              />
            </VictoryChart>
          </View>
        </View>

      <View className="items-center rounded-2xl border border-border bg-card p-3">
        <Text className="mb-2 self-stretch text-base font-semibold text-foreground"># of Transactions Involved</Text>
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

