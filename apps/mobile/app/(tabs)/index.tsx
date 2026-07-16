import { useCallback, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Dimensions,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  UIManager,
  View,
  useWindowDimensions,
} from 'react-native';
import MaterialIcons from '@react-native-vector-icons/material-icons';
import { Link, router, useFocusEffect } from 'expo-router';
import {
  VictoryAxis,
  VictoryChart,
  VictoryLegend,
  VictoryLine,
  VictoryPie,
  VictoryScatter,
  VictoryTheme,
} from 'victory-native';

import { useAuth } from '@/lib/auth/auth-context';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { getCategoryNameRows } from '@/lib/supabase/categories';
import { getWallets } from '@/lib/supabase/wallets';
import { getWalletBalances } from '@/lib/supabase/balances';
import { deleteTransaction, getTransactions } from '@/lib/supabase/transactions';
import { formatTransferLabel } from '@/lib/supabase/transaction-balance';
import {
  buildBalanceLinesByCurrency,
  collapseInternalTransfers,
  expenseTotalsByCurrency,
  formatCurrencyTotals,
  groupExpensesByCategory,
  isAllWalletsMode,
  mergeWalletBundles,
  resolveActiveWalletIds,
  type HomeWalletTx,
  type WalletTxBundle,
} from '@/lib/wallets/home-aggregation';
import { SyncStatusIndicator } from '@/components/sync-status-indicator';
import { WalletStrip } from '@/components/wallets/wallet-strip';
import { chipClass, chipTextClass } from '@/components/ui/chip';

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

const LINE_CHART_COLORS = ['#6366f1', '#14b8a6', '#f59e0b', '#ec4899', '#8b5cf6'];

export default function WalletsScreen() {
  const screenWidth = Dimensions.get('window').width;
  const { width, height } = useWindowDimensions();
  const tokens = useThemeTokens();
  const horizontalPadding = 16;
  const cardWidth = Math.floor((screenWidth - horizontalPadding * 2) / 2.5);
  const cardHeight = 132;
  const chartWidth = Math.max(width - 48, 280);
  const { user } = useAuth();
  const [wallets, setWallets] = useState<any[]>([]);
  const [balances, setBalances] = useState<Record<string, number>>({});
  const [categoryMap, setCategoryMap] = useState<Record<string, string>>({});
  const [refreshing, setRefreshing] = useState(false);
  const [selectedWalletIds, setSelectedWalletIds] = useState<Set<string>>(new Set());
  const [cacheRevision, setCacheRevision] = useState(0);

  const walletTxCacheRef = useRef<Record<string, WalletTxBundle>>({});

  const hasSvgViewManager = useMemo(() => {
    if (Platform.OS !== 'android') return true;
    const getConfig = UIManager.getViewManagerConfig?.bind(UIManager);
    if (!getConfig) return false;
    return Boolean(getConfig('RNSVGRect') || getConfig('RCTRNSVGRect'));
  }, []);

  const isAllMode = useMemo(
    () => isAllWalletsMode(wallets, selectedWalletIds),
    [wallets, selectedWalletIds],
  );

  const activeWalletIds = useMemo(
    () => resolveActiveWalletIds(wallets, selectedWalletIds),
    [wallets, selectedWalletIds],
  );

  const walletMap = useMemo(
    () => Object.fromEntries(wallets.map((w) => [w.id, w])),
    [wallets],
  );

  const walletCurrencyMap = useMemo(
    () =>
      Object.fromEntries(
        wallets.map((w) => [w.id, (w.currency ?? 'USD').toUpperCase()]),
      ),
    [wallets],
  );

  const aggregated = useMemo(() => {
    void cacheRevision;
    const merged = mergeWalletBundles(walletTxCacheRef.current, activeWalletIds, {
      recentLimit: 5,
      chartLimit: 2000,
    });
    return {
      recent: collapseInternalTransfers(merged.recent, activeWalletIds),
      chart: collapseInternalTransfers(merged.chart, activeWalletIds),
    };
  }, [activeWalletIds, cacheRevision]);

  const chartTheme = useMemo(() => VictoryTheme.material, []);

  const pieData = useMemo(
    () => groupExpensesByCategory(aggregated.chart, categoryMap),
    [aggregated.chart, categoryMap],
  );

  const pieExpenseTotals = useMemo(
    () => expenseTotalsByCurrency(aggregated.chart, walletCurrencyMap),
    [aggregated.chart, walletCurrencyMap],
  );

  const pieCenterLabel = useMemo(
    () => formatCurrencyTotals(pieExpenseTotals),
    [pieExpenseTotals],
  );

  const balanceLineSeries = useMemo(
    () => buildBalanceLinesByCurrency(aggregated.chart, wallets, activeWalletIds),
    [aggregated.chart, wallets, activeWalletIds],
  );

  const pieTotal = useMemo(() => pieData.reduce((s, p) => s + (p.y || 0), 0), [pieData]);

  const pieLegendData = useMemo(() => {
    const total = pieTotal || 1;
    return (pieData.length ? pieData : [{ x: 'No expenses', y: 1 }]).slice(0, 6).map((item, index) => ({
      name: `${item.x} (${Math.round((item.y / total) * 100)}%)`,
      symbol: { fill: tokens.chart[index % tokens.chart.length] },
    }));
  }, [pieData, pieTotal, tokens.chart]);

  const lineLegendData = useMemo(
    () =>
      balanceLineSeries.map((series, index) => ({
        name: series.currency,
        symbol: { fill: LINE_CHART_COLORS[index % LINE_CHART_COLORS.length] },
      })),
    [balanceLineSeries],
  );

  const totalBalance = useMemo(
    () =>
      wallets.reduce(
        (sum, w) => sum + (balances[w.id] ?? w.currentBalance ?? w.initialBalance ?? 0),
        0,
      ),
    [wallets, balances],
  );

  const primaryCurrency = wallets[0]?.currency ?? 'USD';

  const greetingName = useMemo(() => {
    const meta = (user as any)?.user_metadata;
    const name = meta?.display_name || meta?.full_name;
    if (typeof name === 'string' && name.trim()) return name.trim().split(' ')[0];
    const email = user?.email ?? '';
    return email.split('@')[0] || 'there';
  }, [user]);

  const pieHeight = useMemo(() => {
    const base = Math.round(Math.min(420, Math.max(220, chartWidth * 0.66)));
    return Math.min(base, Math.round(height * 0.48));
  }, [chartWidth, height]);

  const lineChartHeight = useMemo(() => {
    const base = Math.round(Math.min(360, Math.max(200, chartWidth * 0.56)));
    return Math.min(base, Math.round(height * 0.45));
  }, [chartWidth, height]);

  const pieInnerRadius = Math.max(36, Math.round(chartWidth * 0.12));

  const balanceChartTitle = useMemo(() => {
    if (isAllMode) return 'Balance over time (all wallets)';
    if (activeWalletIds.length === 1) {
      const w = walletMap[activeWalletIds[0]];
      return `Balance over time (${w?.name ?? 'Wallet'})`;
    }
    return `Balance over time (${activeWalletIds.length} wallets)`;
  }, [isAllMode, activeWalletIds, walletMap]);

  const fetchBundleForWallet = useCallback(async (walletId: string): Promise<WalletTxBundle> => {
    const [txRecent, txForCharts] = await Promise.all([
      getTransactions(walletId, 5),
      getTransactions(walletId, 2000),
    ]);
    return { recent: txRecent as HomeWalletTx[], chart: txForCharts as HomeWalletTx[] };
  }, []);

  const prefetchWalletCaches = useCallback(
    async (walletIds: string[]) => {
      await Promise.all(
        walletIds.map(async (id) => {
          try {
            const bundle = await fetchBundleForWallet(id);
            walletTxCacheRef.current[id] = bundle;
          } catch (e) {
            console.error('Prefetch wallet transactions failed', id, e);
          }
        }),
      );
    },
    [fetchBundleForWallet],
  );

  const refreshWalletCaches = useCallback(
    async (walletIds: string[]) => {
      await Promise.all(
        walletIds.map(async (id) => {
          try {
            const bundle = await fetchBundleForWallet(id);
            walletTxCacheRef.current[id] = bundle;
          } catch (e) {
            console.error('Refresh wallet transactions failed', id, e);
          }
        }),
      );
      setCacheRevision((r) => r + 1);
    },
    [fetchBundleForWallet],
  );

  const loadData = useCallback(async () => {
    if (!user) return;

    try {
      const [walletsData, categoryRows] = await Promise.all([
        getWallets(),
        getCategoryNameRows(),
      ]);
      const walletList = walletsData || [];
      setWallets(walletList);
      setCategoryMap(
        Object.fromEntries(categoryRows.map((row) => [row.id, row.name ?? 'Uncategorized'])),
      );

      const walletIds = walletList.map((w: { id: string }) => w.id);
      const balancesDataFiltered = await getWalletBalances(walletIds);
      setBalances(balancesDataFiltered);

      setSelectedWalletIds((prev) => {
        const next = new Set([...prev].filter((id) => walletIds.includes(id)));
        return next;
      });

      walletTxCacheRef.current = {};
      await prefetchWalletCaches(walletIds);
      setCacheRevision((r) => r + 1);
    } catch (error) {
      console.error('Error loading wallets:', error);
    }
  }, [user, prefetchWalletCaches]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const toggleWalletSelection = useCallback(
    (walletId: string) => {
      setSelectedWalletIds((prev) => {
        const allMode = isAllWalletsMode(wallets, prev);
        if (allMode && prev.size === 0) {
          return new Set([walletId]);
        }
        const next = new Set(prev);
        if (next.has(walletId)) {
          next.delete(walletId);
          return next.size === 0 ? new Set() : next;
        }
        next.add(walletId);
        return next.size >= wallets.length ? new Set() : next;
      });
    },
    [wallets],
  );

  const handleSelectAllWallets = useCallback(() => {
    setSelectedWalletIds(new Set());
  }, []);

  const handleDeleteTransaction = useCallback(
    (tx: HomeWalletTx) => {
      Alert.alert(
        'Delete transaction',
        'This will remove the transaction from your records.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              try {
                await deleteTransaction(tx.id);
                const idsToRefresh = new Set<string>([tx.walletId]);
                if (tx.transferToWalletId) idsToRefresh.add(tx.transferToWalletId);
                for (const id of idsToRefresh) {
                  delete walletTxCacheRef.current[id];
                }
                await refreshWalletCaches([...idsToRefresh]);
              } catch (e) {
                Alert.alert('Error', e instanceof Error ? e.message : 'Failed to delete');
              }
            },
          },
        ],
      );
    },
    [refreshWalletCaches],
  );

  const walletNames = useMemo(
    () => Object.fromEntries(wallets.map((w) => [w.id, w.name ?? 'Wallet'])),
    [wallets],
  );

  const singleViewingWalletId =
    activeWalletIds.length === 1 ? activeWalletIds[0] : undefined;

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData]),
  );

  return (
    <View className="flex-1 bg-background pt-5">
      <ScrollView
        nestedScrollEnabled
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 0, flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View className="flex-row items-start justify-between px-4 pb-1 pt-2">
          <View>
            <Text className="text-sm text-muted">{getGreeting()},</Text>
            <Text className="text-2xl font-bold capitalize text-foreground">{greetingName}</Text>
          </View>
          <SyncStatusIndicator />
        </View>

        <View className="px-4 pb-1 pt-2">
          <Text className="text-xs font-semibold uppercase tracking-wide text-muted">
            Total balance
          </Text>
          <Text className="mt-1 text-4xl font-bold text-foreground">
            {primaryCurrency} {totalBalance.toFixed(2)}
          </Text>
        </View>

        {!isAllMode && selectedWalletIds.size > 0 ? (
          <View className="mt-4 px-4">
            <TouchableOpacity
              className={chipClass(true)}
              onPress={handleSelectAllWallets}
              activeOpacity={0.85}
            >
              <Text className={`text-xs ${chipTextClass(true)}`}>All wallets</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <View className="mt-4">
          <WalletStrip
            wallets={wallets}
            balances={balances}
            cardWidth={cardWidth}
            cardHeight={cardHeight}
            isAllMode={isAllMode}
            selectedWalletIds={selectedWalletIds}
            onToggleWallet={toggleWalletSelection}
          />
        </View>

        <View className="mt-4 px-4 pb-8">
          {wallets.length > 0 && hasSvgViewManager ? (
            <View className="mb-6 rounded-3xl border border-border bg-card p-4">
              <View className="flex-row items-center justify-between">
                <Text className="text-base font-semibold text-foreground">Budgeting</Text>
                <Link href="/summary" asChild>
                  <TouchableOpacity>
                    <Text className="text-xs font-semibold text-primary">View Analytics</Text>
                  </TouchableOpacity>
                </Link>
              </View>
              <View style={{ position: 'relative' }}>
                <VictoryPie
                  theme={chartTheme}
                  width={chartWidth}
                  height={pieHeight}
                  data={pieData.length ? pieData : [{ x: 'No expenses', y: 1 }]}
                  colorScale={[...tokens.chart]}
                  innerRadius={pieInnerRadius}
                  padAngle={2}
                  labels={() => ''}
                  style={{
                    labels: { fill: tokens.foreground, fontSize: 10, padding: 4 },
                  }}
                />
                <View
                  pointerEvents="none"
                  style={{
                    position: 'absolute',
                    top: 0,
                    bottom: 0,
                    left: 0,
                    right: 0,
                    alignItems: 'center',
                    justifyContent: 'center',
                    paddingHorizontal: 24,
                  }}
                >
                  <Text className="text-[11px] text-muted">Spent this period</Text>
                  <Text className="text-center text-lg font-bold text-foreground" numberOfLines={2}>
                    {pieCenterLabel}
                  </Text>
                </View>
              </View>
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
          ) : null}

          <View className="mb-3 flex-row items-center justify-between">
            <Text className="text-base font-semibold text-foreground">Recent Transactions</Text>
            <Link href="/transaction" asChild>
              <TouchableOpacity>
                <Text className="text-xs font-semibold text-primary">See all</Text>
              </TouchableOpacity>
            </Link>
          </View>

          {aggregated.recent.map((item) => {
            const isIncome = item.type === 'income';
            const isTransfer = item.type === 'transfer';
            const txCurrency = walletCurrencyMap[item.walletId] ?? 'USD';
            const title = isTransfer
              ? formatTransferLabel(
                {
                  wallet_id: item.walletId,
                  transfer_to_wallet_id: item.transferToWalletId,
                  type: item.type,
                },
                walletNames,
                singleViewingWalletId,
              )
              : item.merchant || item.description || item.type;
            const amountClass = isTransfer
              ? 'text-transfer'
              : isIncome
                ? 'text-income'
                : 'text-expense';
            return (
              <Pressable
                key={item.id}
                accessibilityRole="button"
                accessibilityHint="Opens transaction details"
                onPress={() => {
                  router.push({ pathname: '/transaction/[id]', params: { id: item.id } });
                }}
                style={({ pressed }) => (pressed ? { opacity: 0.92 } : undefined)}
                className="mb-2 flex-row items-center gap-3 rounded-2xl border border-border bg-card p-3"
              >
                <View className="h-10 w-10 items-center justify-center rounded-xl bg-background-muted">
                  <MaterialIcons
                    name={isTransfer ? 'swap-horiz' : isIncome ? 'arrow-downward' : 'arrow-upward'}
                    size={18}
                    color={
                      isTransfer ? tokens.transfer : isIncome ? tokens.income : tokens.expense
                    }
                  />
                </View>
                <View className="min-w-0 flex-1 pr-1">
                  <Text className="text-base text-foreground" numberOfLines={1}>
                    {title}
                  </Text>
                  <Text className="text-xs text-muted">
                    {new Date(item.transactionDate).toLocaleDateString()}
                  </Text>
                </View>
                <View className="items-end">
                  <Text className={`text-base font-semibold ${amountClass}`}>
                    {isTransfer ? '' : isIncome ? '+' : '-'}
                    {txCurrency} {item.amount.toFixed(2)}
                  </Text>
                  <Pressable
                    accessibilityLabel="Delete transaction"
                    hitSlop={8}
                    onPress={() => handleDeleteTransaction(item)}
                    className="mt-1 rounded p-0.5 active:opacity-70"
                  >
                    <MaterialIcons name="delete-outline" size={16} color={tokens.muted} />
                  </Pressable>
                </View>
              </Pressable>
            );
          })}

          {aggregated.recent.length === 0 ? (
            <View className="mb-2 rounded-2xl border border-dashed border-border bg-card p-4">
              <Text className="text-center text-sm text-muted">
                {wallets.length === 0
                  ? 'Add a wallet to get started.'
                  : 'No transactions yet. Tap + Add to create one.'}
              </Text>
            </View>
          ) : null}

          {wallets.length > 0 && hasSvgViewManager ? (
            <View className="mb-2 mt-6 rounded-2xl border border-border bg-card p-3">
              <Text className="mb-2 text-base font-semibold text-foreground">
                {balanceChartTitle}
              </Text>
              <VictoryChart
                theme={chartTheme}
                width={chartWidth}
                height={lineChartHeight}
                padding={{
                  top: 10,
                  bottom: 50,
                  left: Math.max(56, Math.round(width * 0.06)),
                  right: 20,
                }}
                scale={{ x: 'time', y: 'linear' }}
                domainPadding={{ x: 8, y: 12 }}
              >
                <VictoryAxis
                  label="Date"
                  tickFormat={(tick) =>
                    `${new Date(tick).getMonth() + 1}/${new Date(tick).getDate()}`
                  }
                  style={{
                    tickLabels: { fill: tokens.muted, fontSize: 10 },
                    axisLabel: { fill: tokens.muted, fontSize: 11, padding: 28 },
                  }}
                />
                <VictoryAxis
                  dependentAxis
                  tickFormat={(tick) => `${Number(tick).toFixed(0)}`}
                  style={{
                    tickLabels: { fill: tokens.muted, fontSize: 10 },
                    axisLabel: { fill: tokens.muted, fontSize: 11, padding: 56 },
                  }}
                />
                {balanceLineSeries.map((series, index) => {
                  const color = LINE_CHART_COLORS[index % LINE_CHART_COLORS.length];
                  return (
                    <VictoryLine
                      key={series.currency}
                      data={series.points}
                      style={{ data: { stroke: color, strokeWidth: 3 } }}
                    />
                  );
                })}
                {balanceLineSeries.map((series, index) => {
                  const color = LINE_CHART_COLORS[index % LINE_CHART_COLORS.length];
                  return (
                    <VictoryScatter
                      key={`scatter-${series.currency}`}
                      data={series.points}
                      size={4}
                      style={{ data: { fill: color } }}
                    />
                  );
                })}
              </VictoryChart>
              {lineLegendData.length > 0 ? (
                <VictoryLegend
                  width={chartWidth}
                  height={36}
                  orientation="horizontal"
                  gutter={12}
                  itemsPerRow={3}
                  data={lineLegendData}
                  style={{ labels: { fill: tokens.muted, fontSize: 11 } }}
                />
              ) : null}
            </View>
          ) : null}

          {wallets.length > 0 && !hasSvgViewManager ? (
            <View className="mt-6 rounded-xl border border-border bg-card p-4">
              <Text className="text-sm text-muted">
                Charts need native SVG support. Reinstall the dev client after dependency changes
                (react-native-svg).
              </Text>
            </View>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}
