import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
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
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
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
import { useColorScheme } from '@/hooks/use-color-scheme';
import { syncSystem } from '@/lib/powersync/Powersync';
import { getWallets, deleteWallet } from '@/lib/supabase/wallets';
import { getWalletBalances } from '@/lib/supabase/balances';
import { deleteTransaction, getTransactions } from '@/lib/supabase/transactions';
import { PowerSyncStatusIndicator } from '@/components/power-sync-status-indicator';
import type { ICarouselInstance } from "react-native-reanimated-carousel";
import Carousel from "react-native-reanimated-carousel";
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

type WalletTx = {
  id: string;
  walletId: string;
  amount: number;
  type: 'income' | 'expense' | 'transfer';
  categoryId?: string | null;
  transactionDate: string;
};

type WalletTxBundle = { recent: any[]; chart: WalletTx[] };

const DOT_ACTIVE_W = 24;
const DOT_INACTIVE_W = 8;

const PIE_COLOR_SCALE = ['#0a7ea4', '#3b82f6', '#6366f1', '#8b5cf6', '#ec4899', '#f59e0b'];

function WalletPaginationDots({
  count,
  activeIndex,
  onPressDot,
}: {
  count: number;
  activeIndex: SharedValue<number>;
  onPressDot: (index: number) => void;
}) {
  if (count <= 0) return null;
  return (
    <View className="mt-5 mb-2 flex-row items-center justify-center gap-1">
      {Array.from({ length: count }, (_, index) => (
        <WalletPaginationDot
          key={`wallet-dot-${index}`}
          index={index}
          activeIndex={activeIndex}
          onPress={() => onPressDot(index)}
        />
      ))}
    </View>
  );
}

function WalletPaginationDot({
  index,
  activeIndex,
  onPress,
}: {
  index: number;
  activeIndex: SharedValue<number>;
  onPress: () => void;
}) {
  const style = useAnimatedStyle(() => {
    const active = Math.round(activeIndex.value) === index;
    return {
      width: withTiming(active ? DOT_ACTIVE_W : DOT_INACTIVE_W, { duration: 180 }),
      backgroundColor: active ? '#8494FF' : '#94a3b8',
    };
  });
  return (
    <Pressable onPress={onPress} hitSlop={6} accessibilityRole="button">
      <Animated.View style={[{ height: 8, borderRadius: 9999, marginLeft: 4 }, style]} />
    </Pressable>
  );
}

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
  /** Bumps when `focusedWalletIndexRef` changes so the tree re-renders without storing the index in React state. */
  const [snapRevision, setSnapRevision] = useState(0);
  const focusedWalletIndexRef = useRef(0);
  const carouselRef = useRef<ICarouselInstance>(null);
  const [expandedWalletId, setExpandedWalletId] = useState<string | null>(null);

  const walletTxCacheRef = useRef<Record<string, WalletTxBundle>>({});
  const walletFetchGenRef = useRef(0);
  const activeIndexShared = useSharedValue(0);

  const hasSvgViewManager = useMemo(() => {
    if (Platform.OS !== 'android') return true;
    const getConfig = UIManager.getViewManagerConfig?.bind(UIManager);
    if (!getConfig) return false;
    return Boolean(getConfig('RNSVGRect') || getConfig('RCTRNSVGRect'));
  }, []);

  const focusedWallet = useMemo(() => {
    void snapRevision;
    const i = focusedWalletIndexRef.current;
    if (i < 0 || i >= wallets.length) return null;
    return wallets[i] ?? null;
  }, [wallets, snapRevision]);

  const chartTheme = useMemo(() => VictoryTheme.material, []);

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
      symbol: { fill: PIE_COLOR_SCALE[index % PIE_COLOR_SCALE.length] },
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

  const fetchBundleForWallet = useCallback(async (walletId: string): Promise<WalletTxBundle> => {
    const [txRecent, txForCharts] = await Promise.all([
      getTransactions(walletId, 5),
      getTransactions(walletId, 2000),
    ]);
    return { recent: txRecent, chart: txForCharts as WalletTx[] };
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
        })
      );
    },
    [fetchBundleForWallet]
  );

  const loadWalletTransactions = useCallback(
    async (walletId: string | null, opts?: { forceNetwork?: boolean }) => {
      if (!walletId) {
        setTransactions([]);
        setWalletChartTransactions([]);
        return;
      }
      if (opts?.forceNetwork) {
        delete walletTxCacheRef.current[walletId];
      }
      const cached = walletTxCacheRef.current[walletId];
      if (cached && !opts?.forceNetwork) {
        setTransactions(cached.recent);
        setWalletChartTransactions(cached.chart);
        return;
      }
      const gen = ++walletFetchGenRef.current;
      try {
        const bundle = await fetchBundleForWallet(walletId);
        walletTxCacheRef.current[walletId] = bundle;
        if (gen !== walletFetchGenRef.current) return;
        if (wallets[focusedWalletIndexRef.current]?.id !== walletId) return;
        setTransactions(bundle.recent);
        setWalletChartTransactions(bundle.chart);
      } catch (error) {
        console.error('Error loading transactions:', error);
      }
    },
    [fetchBundleForWallet, wallets]
  );

  const syncFromCacheOrFetch = useCallback(
    (walletId: string | null) => {
      if (!walletId) {
        setTransactions([]);
        setWalletChartTransactions([]);
        return;
      }
      const cached = walletTxCacheRef.current[walletId];
      if (cached) {
        setTransactions(cached.recent);
        setWalletChartTransactions(cached.chart);
        return;
      }
      void loadWalletTransactions(walletId);
    },
    [loadWalletTransactions]
  );

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

      walletTxCacheRef.current = {};
      await prefetchWalletCaches(walletIds);

      const prevIdx = focusedWalletIndexRef.current;
      const clampedIdx = walletList.length
        ? Math.min(Math.max(0, prevIdx), walletList.length - 1)
        : 0;
      focusedWalletIndexRef.current = walletList.length ? clampedIdx : 0;
      activeIndexShared.value = clampedIdx;
      syncFromCacheOrFetch(walletList[clampedIdx]?.id ?? null);
      setSnapRevision((r) => r + 1);
    } catch (error) {
      console.error('Error loading wallets:', error);
    }
  }, [user, prefetchWalletCaches, syncFromCacheOrFetch, activeIndexShared]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const handleDeleteTransaction = useCallback(
    (id: string) => {
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
                await deleteTransaction(id);
                const wid = wallets[focusedWalletIndexRef.current]?.id;
                if (wid) delete walletTxCacheRef.current[wid];
                await loadWalletTransactions(wid ?? null, { forceNetwork: true });
              } catch (e) {
                Alert.alert('Error', e instanceof Error ? e.message : 'Failed to delete');
              }
            },
          },
        ],
      );
    },
    [loadWalletTransactions, wallets],
  );

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
                const deletedIndex = wallets.findIndex((w) => w.id === walletId);
                const nextWallets = wallets.filter((w) => w.id !== walletId);
                let nextIdx = focusedWalletIndexRef.current;
                if (deletedIndex === nextIdx) {
                  nextIdx = Math.min(nextIdx, Math.max(0, nextWallets.length - 1));
                } else if (deletedIndex !== -1 && deletedIndex < nextIdx) {
                  nextIdx -= 1;
                }
                focusedWalletIndexRef.current = nextIdx;
                activeIndexShared.value = nextIdx;
                delete walletTxCacheRef.current[walletId];
                await deleteWallet(walletId);
                setWallets(nextWallets);
                setBalances((prev) => {
                  const next = { ...prev };
                  delete next[walletId];
                  return next;
                });
                setSnapRevision((r) => r + 1);
                await loadWalletTransactions(nextWallets[nextIdx]?.id ?? null);
                carouselRef.current?.scrollTo({ index: nextIdx, animated: true });
              } catch (error) {
                console.error('Failed to delete wallet', error);
                Alert.alert('Delete failed', 'Could not delete wallet. Please try again.');
              }
            },
          },
        ]
      );
    },
    [wallets, loadWalletTransactions, activeIndexShared]
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

      return (
        <CarouselItemDepth animationValue={animationValue}>
            <View
              style={{ width: carouselItemWidth, height: 200 }}
              className="rounded-3xl border border-white/20 bg-[#8494FF] p-4 shadow-sm dark:border-indigo-400/25 dark:bg-[#4f54c4] relative"
            >
            <TouchableOpacity
              onPress={() =>
                router.push({ pathname: '/transaction', params: { walletId: item.id } })
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
                        onPress={() => {
                          setExpandedWalletId(null);
                          router.push({ pathname: '/wallet/[id]', params: { id: item.id } });
                        }}
                        className="rounded-full border border-white/40 bg-white/20 px-2 py-1"
                      >
                        <Text className="text-xs font-semibold text-white">Edit</Text>
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
    [balances, handleDeleteWallet, expandedWalletId, setExpandedWalletId, carouselItemWidth]
  );

  const handleWalletDotPress = useCallback(
    (index: number) => {
      focusedWalletIndexRef.current = index;
      activeIndexShared.value = index;
      syncFromCacheOrFetch(wallets[index]?.id ?? null);
      setSnapRevision((r) => r + 1);
      carouselRef.current?.scrollTo({ index, animated: true });
    },
    [wallets, syncFromCacheOrFetch, activeIndexShared]
  );

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

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
              <Text className="text-base text-slate-700 dark:text-slate-100 font-bold">{focusedWallet?.icon ?? 'W'}</Text>
            </View>
            <Text className="text-2xl ml-3 font-bold text-gray-900 dark:text-white">Wallets</Text>
          </View>
          <PowerSyncStatusIndicator />
        </View>

        <View id="carousel-component" className="top-8">
          {wallets.length ? (
            <Carousel
              ref={carouselRef}
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
                  focusedWalletIndexRef.current = index;
                  activeIndexShared.value = index;
                  syncFromCacheOrFetch(wallets[index]?.id ?? null);
                  setSnapRevision((r) => r + 1);
                }
              }}
              renderItem={renderWalletCarouselItem}
            />
          ) : (
            <Carousel
              ref={carouselRef}
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

        <WalletPaginationDots
          count={wallets.length}
          activeIndex={activeIndexShared}
          onPressDot={handleWalletDotPress}
        />

        <View className="bg-[#6367FF]/70 dark:bg-[#2a2d5c]/95 rounded-t-2xl mt-1">
          <View className="flex-row justify-between relative">
            <View className="h-15 w-12 left-12 rounded-b-4xl border-l-4 border-r-4 border-b-4 border-[#EDEDED] dark:border-slate-700 bg-[#9EADFF] dark:bg-[#4a5080] bottom-1" />
            <View className="h-15 w-12 right-12 rounded-b-4xl border-l-4 border-r-4 border-b-4 border-[#EDEDED] dark:border-slate-700 bg-[#9EADFF] dark:bg-[#4a5080] bottom-1" />
          </View>

          <View className="bg-[#FAFAFA]/80 dark:bg-gray-950/95 mt-1 rounded-t-2xl px-4 pt-6 pb-8">
            <View className="flex-row justify-between items-center mb-2">
              <Text className="text-sm font-semibold text-slate-700 dark:text-slate-100">
                Recent Transactions
              </Text>
              <Link
                href={
                  (focusedWallet?.id
                    ? `/transaction/new?walletId=${focusedWallet.id}`
                    : '/transaction/new') as any
                }
                asChild>
                <TouchableOpacity className="bg-blue-600 dark:bg-blue-500 px-4 py-2 rounded-lg">
                  <Text className="text-white font-semibold">+ Add</Text>
                </TouchableOpacity>
              </Link>
            </View>
            {transactions.map((item) => {
              const canEdit = item.type === 'income' || item.type === 'expense';
              return (
                <View
                  key={item.id}
                  className="mb-2 rounded-xl border border-slate-300 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-800"
                >
                  <View className="flex-row items-start justify-between gap-2">
                    <View className="min-w-0 flex-1 pr-1">
                      <View className="flex-row items-baseline gap-1 flex-wrap">
                        <Text
                          className={`text-base font-semibold ${item.type === 'income' ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}
                        >
                          {item.type === 'income' ? '+' : '-'}
                          {item.amount.toFixed(2)}
                        </Text>
                        <Text className="text-xs text-slate-500 dark:text-slate-400">
                          {focusedWallet?.currency ?? 'USD'}
                        </Text>
                      </View>
                      <Text className="text-base text-slate-900 dark:text-white">
                        {item.merchant || item.description || item.type}
                      </Text>
                      <Text className="text-xs text-slate-600 dark:text-slate-400">
                        {new Date(item.transactionDate).toLocaleDateString()}
                      </Text>
                    </View>
                    <View className="flex items-center gap-0.5 pt-0.5">
                      {canEdit ? (
                        <Pressable
                          accessibilityLabel="Edit transaction"
                          hitSlop={8}
                          onPress={() =>
                            router.push({ pathname: '/transaction/[id]', params: { id: item.id } })
                          }
                          className="rounded p-1 active:opacity-70"
                        >
                          <MaterialIcons name="edit" size={18} color="#64748b" />
                        </Pressable>
                      ) : null}
                      <Pressable
                        accessibilityLabel="Delete transaction"
                        hitSlop={8}
                        onPress={() => handleDeleteTransaction(item.id)}
                        className="rounded p-1 active:opacity-70"
                      >
                        <MaterialIcons name="delete-outline" size={18} color="#ef4444" />
                      </Pressable>
                    </View>
                  </View>
                </View>
              );
            })}
            {transactions.length === 0 ? (
              <View className="mb-2 rounded-xl border border-dashed border-slate-300 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
                <Text className="text-center text-sm text-slate-500 dark:text-slate-400">
                  No transactions for this wallet yet. Tap + Add to create one.
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
                    colorScale={PIE_COLOR_SCALE}
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
