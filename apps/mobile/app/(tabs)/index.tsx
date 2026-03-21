import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Alert,
  Dimensions,
  Platform,
  UIManager,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  useWindowDimensions,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
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
import { useColorScheme } from '@/hooks/use-color-scheme';
import { mmkvStorage } from '@/lib/storage/mmkv-storage';
import { syncSystem } from '@/lib/powersync/Powersync';
import { getWallets, deleteWallet } from '@/lib/supabase/wallets';
import { getWalletBalances } from '@/lib/supabase/balances';
import { getTransactions } from '@/lib/supabase/transactions';
import { PowerSyncStatusIndicator } from '@/components/power-sync-status-indicator';
import * as React from "react";
import type { ICarouselInstance } from "react-native-reanimated-carousel";
import Carousel from "react-native-reanimated-carousel";
import Animated, { Extrapolation, interpolate, useAnimatedStyle, type SharedValue } from 'react-native-reanimated';

type WalletTx = {
  id: string;
  walletId: string;
  amount: number;
  type: 'income' | 'expense' | 'transfer';
  categoryId?: string | null;
  transactionDate: string;
};

const MAIN_WALLET_KEY = 'main_wallet_id';

function CarouselItemDepth({
  animationValue,
  children,
}: {
  animationValue: SharedValue<number>;
  children: ReactNode;
}) {
  const animatedStyle = useAnimatedStyle(() => {
    const distance = Math.abs(animationValue.value);
    return {
      opacity: interpolate(distance, [0, 1], [1, 0.7], Extrapolation.CLAMP),
      transform: [
        {
          scale: interpolate(distance, [0, 1], [1, 0.9], Extrapolation.CLAMP),
        },
      ],
    };
  });

  return <Animated.View style={animatedStyle}>{children}</Animated.View>;
}

export default function WalletsScreen() {
  const screenWidth = Dimensions.get('window').width;
  const { width, height } = useWindowDimensions();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const carouselItemWidth = Math.min(screenWidth - 56, 340);
  const chartWidth = Math.max(width - 48, 280);
  const { user } = useAuth();
  const [wallets, setWallets] = useState<any[]>([]);
  const [balances, setBalances] = useState<Record<string, number>>({});
  const [transactions, setTransactions] = useState<any[]>([]);
  const [walletChartTransactions, setWalletChartTransactions] = useState<WalletTx[]>([]);
  const [categoryMap, setCategoryMap] = useState<Record<string, string>>({});
  const [refreshing, setRefreshing] = useState(false);
  const [mainWalletId, setMainWalletId] = useState<string | null>(null);
  const [activeWalletIndex, setActiveWalletIndex] = useState(0);
  const [expandedWalletId, setExpandedWalletId] = useState<string | null>(null);

  const hasSvgViewManager = useMemo(() => {
    if (Platform.OS !== 'android') return true;
    const getConfig = UIManager.getViewManagerConfig?.bind(UIManager);
    if (!getConfig) return false;
    return Boolean(getConfig('RNSVGRect') || getConfig('RCTRNSVGRect'));
  }, []);

  const mainWallet = wallets.find((w) => w.id === mainWalletId) ?? wallets[0] ?? null;

  const focusedWallet = useMemo(() => {
    if (activeWalletIndex < 0 || activeWalletIndex >= wallets.length) return null;
    return wallets[activeWalletIndex] ?? null;
  }, [wallets, activeWalletIndex]);

  const chartTheme = useMemo(() => VictoryTheme.material, []);
  const pieColorScale = ['#0a7ea4', '#3b82f6', '#6366f1', '#8b5cf6', '#ec4899', '#f59e0b'];

  const pieData = useMemo(() => {
    const totals: Record<string, number> = {};
    walletChartTransactions.forEach((tx) => {
      if (tx.type !== 'expense') return;
      const categoryName = tx.categoryId
        ? categoryMap[tx.categoryId] ?? 'Uncategorized'
        : 'Uncategorized';
      totals[categoryName] = (totals[categoryName] ?? 0) + tx.amount;
    });
    const entries = Object.entries(totals)
      .map(([x, y]) => ({ x, y }))
      .sort((a, b) => b.y - a.y);
    if (entries.length <= 6) return entries;
    const top = entries.slice(0, 5);
    const otherTotal = entries.slice(5).reduce((sum, c) => sum + c.y, 0);
    return [...top, { x: 'Other', y: otherTotal }];
  }, [walletChartTransactions, categoryMap]);

  const walletBalanceLineData = useMemo(() => {
    if (!focusedWallet) {
      return [{ x: new Date(), y: 0 }];
    }
    const initial = Number(focusedWallet.initialBalance ?? 0);
    const sorted = [...walletChartTransactions].sort(
      (a, b) => new Date(a.transactionDate).getTime() - new Date(b.transactionDate).getTime()
    );
    if (!sorted.length) {
      return [{ x: new Date(), y: initial }];
    }
    let running = initial;
    const points: { x: Date; y: number }[] = [];
    points.push({ x: new Date(sorted[0].transactionDate), y: Number(running.toFixed(2)) });
    for (const tx of sorted) {
      const delta = tx.type === 'income' ? tx.amount : -tx.amount;
      running += delta;
      points.push({ x: new Date(tx.transactionDate), y: Number(running.toFixed(2)) });
    }
    return points;
  }, [focusedWallet, walletChartTransactions]);

  const pieLegendData = useMemo(() => {
    const total = pieData.reduce((s, p) => s + (p.y || 0), 0) || 1;
    return (pieData.length ? pieData : [{ x: 'No expenses', y: 1 }]).slice(0, 6).map((item, index) => ({
      name: `${item.x} (${Math.round((item.y / total) * 100)}%)`,
      symbol: { fill: pieColorScale[index % pieColorScale.length] },
    }));
  }, [pieData]);

  const pieHeight = useMemo(() => {
    const base = Math.round(Math.min(420, Math.max(220, chartWidth * 0.66)));
    return Math.min(base, Math.round(height * 0.48));
  }, [chartWidth, height]);

  const lineChartHeight = useMemo(() => {
    const base = Math.round(Math.min(360, Math.max(200, chartWidth * 0.56)));
    return Math.min(base, Math.round(height * 0.45));
  }, [chartWidth, height]);

  const pieInnerRadius = Math.max(36, Math.round(chartWidth * 0.12));

  const loadTransactionsForWallet = useCallback(async (walletId?: string | null) => {
    try {
      const [txRecent, txForCharts] = await Promise.all([
        getTransactions(walletId ?? undefined, 5),
        getTransactions(walletId ?? undefined, 2000),
      ]);
      setTransactions(txRecent);
      setWalletChartTransactions(txForCharts as WalletTx[]);
    } catch (error) {
      console.error('Error loading transactions:', error);
    }
  }, []);

  const loadData = useCallback(async () => {
    if (!user) return;

    try {
      const [walletsData, categoryRows] = await Promise.all([
        getWallets(),
        syncSystem.db
          .selectFrom('categories')
          .select(['id', 'name'])
          .where('is_active', '=', 1)
          .execute(),
      ]);
      const walletList = walletsData || [];
      setWallets(walletList);
      setCategoryMap(
        Object.fromEntries(
          categoryRows.map((row) => [row.id, row.name ?? 'Uncategorized'])
        )
      );
      const walletIds = walletList.map((w: any) => w.id);
      const balancesDataFiltered = await getWalletBalances(walletIds);
      setBalances(balancesDataFiltered);

      let storedMainWalletId = await mmkvStorage.getItem(MAIN_WALLET_KEY);
      const hasStoredMain = storedMainWalletId && walletList.some((w: any) => w.id === storedMainWalletId);
      if (!hasStoredMain && walletList.length) {
        const nextMainWalletId = walletList[0].id;
        storedMainWalletId = nextMainWalletId;
        await mmkvStorage.setItem(MAIN_WALLET_KEY, nextMainWalletId);
      }
      const resolvedMainWalletId = storedMainWalletId ?? walletList[0]?.id ?? null;
      setMainWalletId(resolvedMainWalletId);
      const resolvedIndex = walletList.findIndex((w: any) => w.id === resolvedMainWalletId);
      setActiveWalletIndex(resolvedIndex >= 0 ? resolvedIndex : 0);
      await loadTransactionsForWallet(resolvedMainWalletId);
    } catch (error) {
      console.error('Error loading wallets:', error);
    }
  }, [user, loadTransactionsForWallet]);

  const setAsMainWallet = useCallback(async (walletId: string) => {
    await mmkvStorage.setItem(MAIN_WALLET_KEY, walletId);
    setMainWalletId(walletId);
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const handleDeleteWallet = useCallback(
    async (walletId: string) => {
      Alert.alert(
        'Delete wallet',
        'This will permanently delete this wallet and all related transactions. This cannot be undone. Continue?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              try {
                await deleteWallet(walletId);
                setWallets((prev) => {
                  const next = prev.filter((w) => w.id !== walletId);
                  if (mainWalletId === walletId) {
                    const nextMain = next[0]?.id ?? null;
                    if (nextMain) {
                      mmkvStorage.setItem(MAIN_WALLET_KEY, nextMain);
                    } else {
                      mmkvStorage.removeItem(MAIN_WALLET_KEY);
                    }
                    setMainWalletId(nextMain);
                  }
                  return next;
                });
                setBalances((prev) => {
                  const next = { ...prev };
                  delete next[walletId];
                  return next;
                });
              } catch (error) {
                console.error('Failed to delete wallet', error);
                Alert.alert('Delete failed', 'Could not delete wallet. Please try again.');
              }
            },
          },
        ]
      );
    },
    [mainWalletId]
  );

  const renderWalletCarouselItem = useCallback(
    ({ item, animationValue }: { item: any; animationValue: SharedValue<number> }) => {
      if (item.id === 'add') {
        return (
          <CarouselItemDepth animationValue={animationValue}>
            <View
              style={{ width: carouselItemWidth, height: 200 }}
              className="rounded-3xl border border-dashed border-slate-300 bg-white/90 p-4 shadow-sm dark:border-slate-600 dark:bg-slate-800 relative"
            >
              <TouchableOpacity
                onPress={() => router.push('/(routes)/wallet/new' as any)}
                activeOpacity={0.85}
                className="flex-1 items-center justify-center"
              >
                <View className="flex-row items-center space-x-3">
                  <View
                    className="w-11 h-11 rounded-2xl items-center justify-center"
                    style={{ backgroundColor: '#8494FF' }}
                  >
                    <Text className="text-base text-white font-bold">+</Text>
                  </View>
                  
                </View>
                <View className="mt-4">
                  <Text className="text-sm text-slate-500 dark:text-slate-300">Tap to Add New Wallet</Text>
                </View>
              </TouchableOpacity>
            </View>
          </CarouselItemDepth>
        );
      }

      const balance = balances[item.id] ?? item.currentBalance ?? item.initialBalance ?? 0;
      const isMain = item.id === mainWallet?.id;

      return (
        <CarouselItemDepth animationValue={animationValue}>
            <View
              style={{ width: carouselItemWidth, height: 200 }}
              className="rounded-3xl border border-white/20 bg-[#8494FF] p-4 shadow-sm dark:border-indigo-400/25 dark:bg-[#4f54c4] relative"
            >
            <TouchableOpacity
              onPress={() =>
                router.push({ pathname: '/transaction/index', params: { walletId: item.id } })
              }
              activeOpacity={0.85}
            >
              <View className="flex-row items-start justify-between">
                <View className="flex-row items-center space-x-3 flex-1 ">
                  <View className="w-12 h-12 rounded-2xl items-center justify-center bg-white/25">
                    <Text className="text-base text-white font-bold">{item.icon ?? 'W'}</Text>
                  </View>
                  <View className="flex-1 ml-2">
                    <Text className="text-xs font-semibold uppercase tracking-[0.05em] text-[#FAFAFA]/95">
                      {item.type ?? 'Wallet'}
                    </Text>
                    <Text className="text-lg font-bold text-[#FAFAFA]">
                      {item.name}
                    </Text>
                    <Text className="text-xs text-[#FAFAFA]/80">
                      {item.currency ?? 'USD'}
                    </Text>
                  </View>
                </View>

                <View className="flex-row items-start space-x-2">
                  
                  
                  {expandedWalletId === item.id ? (
                    <View className="flex-column items-center space-x-2">
                      <TouchableOpacity
                        onPress={() => setExpandedWalletId(null)}
                        className="rounded-full px-1.5 py-0.5"
                      >
                        <Text className="text-xs font-semibold text-white/80">✕</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={() => setAsMainWallet(item.id)}
                        className={`rounded-full px-2 py-1 border ${
                          isMain
                            ? 'bg-green-600 border-green-600'
                            : 'bg-white/20 border-white/30'
                        }`}
                      >
                        <Text className="text-xs font-semibold text-white">
                          {isMain ? 'Main' : 'Set'}
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={() => handleDeleteWallet(item.id)}
                        className="rounded-full border border-red-300 bg-red-50 px-2 py-1 dark:border-red-500/50 dark:bg-red-950/60"
                      >
                        <Text className="text-xs font-semibold text-red-700 dark:text-red-300">Del</Text>
                      </TouchableOpacity>

                      
                    </View>
                  ) : (
                    <TouchableOpacity
                      onPress={() => setExpandedWalletId(item.id)}
                      className="rounded-full bg-white/25 px-2.5 py-1.5"
                    >
                      <Text className="text-sm font-semibold text-white">⋯</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              <View className="mt-4 top-3">
                <Text className="text-xs text-[#FAFAFA]/80">Balance</Text>
                <Text className="mt-1 text-3xl font-bold text-[#FAFAFA]">
                  ${balance.toFixed(2)}
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        </CarouselItemDepth>
      );
    },
    [balances, handleDeleteWallet, mainWallet?.id, setAsMainWallet, expandedWalletId, setExpandedWalletId, carouselItemWidth]
  );

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const ref = React.useRef<ICarouselInstance>(null);

  return (
    <View className="flex-1 bg-white dark:bg-gray-900 pt-5">
      <ScrollView
        nestedScrollEnabled
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 0, flexGrow: 1 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View className="px-4 pt-4 pb-2 flex-row items-center justify-between">
          <View className="flex-row items-center space-x-2">
            <View className="w-9 h-9 rounded-xl bg-slate-200 dark:bg-slate-700 items-center justify-center">
              <Text className="text-base text-slate-700 dark:text-slate-100 font-bold">{mainWallet?.icon ?? 'W'}</Text>
            </View>
            <Text className="text-2xl ml-3 font-bold text-gray-900 dark:text-white">Wallets</Text>
          </View>
          <PowerSyncStatusIndicator />
        </View>

        <View id="carousel-component" className="top-8">
          {wallets.length ? (
            <Carousel
              ref={ref}
              autoPlayInterval={2000}
              data={[...wallets, { id: 'add', name: 'Add Wallet', type: 'Action', icon: '+', color: '#10b981' }]}
              loop={true}
              pagingEnabled={true}
              snapEnabled={true}
              width={carouselItemWidth}
              height={240}
              style={{
                width: screenWidth,
                height: 240,
                alignItems: 'center',
                justifyContent: 'center',
              }}
              mode={'parallax'}
              modeConfig={{
                parallaxScrollingScale: 0.96,
                parallaxScrollingOffset: 36,
                parallaxAdjacentItemScale: 0.86,
              }}
              onSnapToItem={(index) => {
                if (index < wallets.length) {
                  setActiveWalletIndex(index);
                  loadTransactionsForWallet(wallets[index]?.id ?? null);
                }
              }}
              renderItem={renderWalletCarouselItem}
            />
          ) : (
            <Carousel
              ref={ref}
              autoPlayInterval={2000}
              data={[{ id: 'add', name: 'Add Wallet', type: 'Action', icon: '+', color: '#10b981' }]}
              loop={true}
              pagingEnabled={true}
              snapEnabled={true}
              width={carouselItemWidth}
              height={240}
              style={{
                width: screenWidth,
                height: 240,
                alignItems: 'center',
                justifyContent: 'center',
              }}
              mode={'parallax'}
              modeConfig={{
                parallaxScrollingScale: 0.96,
                parallaxScrollingOffset: 36,
                parallaxAdjacentItemScale: 0.86,
              }}
              renderItem={renderWalletCarouselItem}
            />
          )}
        </View>

        <View className="mt-5 mb-2 flex-row items-center justify-center space-x-2">
          {Array.from({ length: wallets.length }, (_, index) => {
            const isActive = index === activeWalletIndex;
            return (
              <TouchableOpacity
                key={`wallet-dot-${index}`}
                onPress={() => {
                  setActiveWalletIndex(index);
                  loadTransactionsForWallet(wallets[index]?.id ?? null);
                  ref.current?.scrollTo({ index, animated: true });
                }}
                className={`h-2 ml-1 ${isActive ? 'w-6 bg-[#8494FF]' : 'w-2 bg-slate-300 dark:bg-slate-500'} rounded-full `}
              />
            );
          })}
        </View>

        <View className="bg-[#6367FF]/70 dark:bg-[#2a2d5c]/95 rounded-t-2xl mt-1">
          <View className="flex-row justify-between relative">
            <View className="h-15 w-12 left-12 rounded-b-4xl border-l-4 border-r-4 border-b-4 border-[#EDEDED] dark:border-slate-700 bg-[#9EADFF] dark:bg-[#4a5080] bottom-1" />
            <View className="h-15 w-12 right-12 rounded-b-4xl border-l-4 border-r-4 border-b-4 border-[#EDEDED] dark:border-slate-700 bg-[#9EADFF] dark:bg-[#4a5080] bottom-1" />
          </View>

          <View className="bg-[#FAFAFA]/80 dark:bg-gray-950/95 mt-1 rounded-t-2xl px-4 pt-6 pb-8">
            <Text className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-100">Recent Transactions</Text>
            {transactions.map((item) => (
              <View
                key={item.id}
                className="mb-2 rounded-xl border border-slate-300 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-800"
              >
                <View className="flex-row items-baseline gap-1">
                  <Text
                    className={`text-base font-semibold ${item.type === 'income' ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}
                  >
                    {item.type === 'income' ? '+' : '-'}
                    {item.amount.toFixed(2)}
                  </Text>
                  <Text className="text-xs text-slate-500 dark:text-slate-400">
                    {wallets[activeWalletIndex]?.currency ?? 'USD'}
                  </Text>
                </View>
                <Text className="text-base text-slate-900 dark:text-white">
                  {item.merchant || item.description || item.type}
                </Text>
                <Text className="text-xs text-slate-600 dark:text-slate-400">
                  {new Date(item.transactionDate).toLocaleDateString()}
                </Text>
              </View>
            ))}
            {transactions.length === 0 ? (
              <View className="mb-2 rounded-xl border border-dashed border-slate-300 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
                <Text className="text-sm text-slate-500 dark:text-slate-400">
                  No transactions for this wallet yet.
                </Text>
              </View>
            ) : null}

            {focusedWallet && hasSvgViewManager ? (
              <>
                <View className="mt-6 rounded-xl bg-gray-100 dark:bg-gray-800 p-3">
                  <Text className="text-base font-semibold text-gray-900 dark:text-white mb-2">
                    Expense categories ({focusedWallet.name})
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
                    style={{
                      labels: { fill: isDark ? '#f3f4f6' : '#111827', fontSize: 10, padding: 4 },
                    }}
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

                <View className="mt-6 rounded-xl bg-gray-100 dark:bg-gray-800 p-3 mb-2">
                  <Text className="text-base font-semibold text-gray-900 dark:text-white mb-2">
                    Balance over time ({focusedWallet.name})
                  </Text>
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
                        tickLabels: { fill: isDark ? '#d1d5db' : '#374151', fontSize: 10 },
                        axisLabel: { fill: isDark ? '#d1d5db' : '#374151', fontSize: 11, padding: 28 },
                      }}
                    />
                    <VictoryAxis
                      dependentAxis
                      label={`Balance (${focusedWallet.currency ?? 'USD'})`}
                      tickFormat={(tick) => `${Number(tick).toFixed(0)}`}
                      style={{
                        tickLabels: { fill: isDark ? '#d1d5db' : '#374151', fontSize: 10 },
                        axisLabel: { fill: isDark ? '#d1d5db' : '#374151', fontSize: 11, padding: 56 },
                      }}
                    />
                    <VictoryLine
                      data={walletBalanceLineData}
                      style={{ data: { stroke: '#0a7ea4', strokeWidth: 3 } }}
                    />
                    <VictoryScatter
                      data={walletBalanceLineData}
                      size={4}
                      style={{ data: { fill: '#0a7ea4' } }}
                    />
                  </VictoryChart>
                </View>
              </>
            ) : null}

            {focusedWallet && !hasSvgViewManager ? (
              <View className="mt-6 rounded-xl border border-slate-300 bg-white p-4 dark:border-slate-600 dark:bg-slate-800">
                <Text className="text-sm text-slate-600 dark:text-slate-300">
                  Charts need native SVG support. Reinstall the dev client after dependency changes (react-native-svg).
                </Text>
              </View>
            ) : null}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
