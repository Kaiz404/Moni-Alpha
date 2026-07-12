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
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { getCategoryNameRows } from '@/lib/supabase/categories';
import { getWallets, deleteWallet } from '@/lib/supabase/wallets';
import { getWalletBalances } from '@/lib/supabase/balances';
import { deleteTransaction, getTransactions } from '@/lib/supabase/transactions';
import { transactionDelta, formatTransferLabel } from '@/lib/supabase/transaction-balance';
import { SyncStatusIndicator } from '@/components/sync-status-indicator';
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
  transferToWalletId?: string | null;
  amount: number;
  type: 'income' | 'expense' | 'transfer';
  categoryId?: string | null;
  transactionDate: string;
};

type WalletTxBundle = { recent: any[]; chart: WalletTx[] };

const DOT_ACTIVE_W = 24;
const DOT_INACTIVE_W = 8;

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
  const tokens = useThemeTokens();
  const style = useAnimatedStyle(() => {
    const active = Math.round(activeIndex.value) === index;
    return {
      width: withTiming(active ? DOT_ACTIVE_W : DOT_INACTIVE_W, { duration: 180 }),
      backgroundColor: active ? tokens.primary : '#94a3b8',
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
  const tokens = useThemeTokens();
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
    const walletId = focusedWallet.id;
    for (const tx of sorted) {
      const delta = transactionDelta(
        {
          wallet_id: tx.walletId,
          transfer_to_wallet_id: tx.transferToWalletId,
          amount: tx.amount,
          type: tx.type,
        },
        walletId,
      );
      running += delta;
      points.push({ x: new Date(tx.transactionDate), y: Number(running.toFixed(2)) });
    }
    return points;
  }, [focusedWallet, walletChartTransactions]);

  const pieLegendData = useMemo(() => {
    const total = pieData.reduce((s, p) => s + (p.y || 0), 0) || 1;
    return (pieData.length ? pieData : [{ x: 'No expenses', y: 1 }]).slice(0, 6).map((item, index) => ({
      name: `${item.x} (${Math.round((item.y / total) * 100)}%)`,
      symbol: { fill: tokens.chart[index % tokens.chart.length] },
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
        getCategoryNameRows(),
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
              className="relative rounded-3xl border border-dashed border-border bg-card p-4 shadow-sm"
            >
              <TouchableOpacity
                onPress={() => router.push('/(routes)/wallet/new' as any)}
                activeOpacity={0.85}
                className="flex-1 items-center justify-center"
              >
                <View className="flex-row items-center space-x-3">
                  <View
                    className="h-11 w-11 items-center justify-center rounded-2xl"
                    style={{ backgroundColor: tokens.primary }}
                  >
                    <Text className="text-base font-bold text-primary-foreground">+</Text>
                  </View>
                  
                </View>
                <View className="mt-4">
                  <Text className="text-sm text-muted">Tap to Add New Wallet</Text>
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
              className="relative rounded-3xl border border-white/20 bg-primary p-4 shadow-sm"
            >
            <TouchableOpacity
              onPress={() =>
                router.push({ pathname: '/transaction', params: { walletId: item.id } })
              }
              activeOpacity={0.85}
            >
              <View className="flex-row items-start justify-between">
                <View className="flex-row items-center space-x-3 flex-1 ">
                  <View className="h-12 w-12 items-center justify-center rounded-2xl bg-white/25">
                    <Text className="text-base font-bold text-primary-foreground">{item.icon ?? 'W'}</Text>
                  </View>
                  <View className="flex-1 ml-2">
                    <Text className="text-xs font-semibold uppercase tracking-[0.05em] text-primary-foreground/95">
                      {item.type ?? 'Wallet'}
                    </Text>
                    <Text className="text-lg font-bold text-primary-foreground">
                      {item.name}
                    </Text>
                    <Text className="text-xs text-primary-foreground/80">
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
                        <Text className="text-xs font-semibold text-primary-foreground/80">✕</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={() => {
                          setExpandedWalletId(null);
                          router.push({ pathname: '/wallet/[id]', params: { id: item.id } });
                        }}
                        className="rounded-full border border-white/40 bg-white/20 px-2 py-1"
                      >
                        <Text className="text-xs font-semibold text-primary-foreground">Edit</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={() => handleDeleteWallet(item.id)}
                        className="rounded-full border border-danger/40 bg-danger/10 px-2 py-1"
                      >
                        <Text className="text-xs font-semibold text-danger">Del</Text>
                      </TouchableOpacity>

                      
                    </View>
                  ) : (
                    <TouchableOpacity
                      onPress={() => setExpandedWalletId(item.id)}
                      className="rounded-full bg-white/25 px-2.5 py-1.5"
                    >
                      <Text className="text-sm font-semibold text-primary-foreground">⋯</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              <View className="mt-4 top-3">
                <Text className="text-xs text-primary-foreground/80">Balance</Text>
                <Text className="mt-1 text-3xl font-bold text-primary-foreground">
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
    <View className="flex-1 bg-background pt-5">
      <ScrollView
        nestedScrollEnabled
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 0, flexGrow: 1 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View className="px-4 pt-4 pb-2 flex-row items-center justify-between">
          <View className="flex-row items-center space-x-2">
            <View className="h-9 w-9 items-center justify-center rounded-xl bg-background-muted">
              <Text className="text-base font-bold text-foreground">{focusedWallet?.icon ?? 'W'}</Text>
            </View>
            <Text className="ml-3 text-2xl font-bold text-foreground">Wallets</Text>
          </View>
          <SyncStatusIndicator />
        </View>

        <View id="carousel-component" className="top-8">
          {wallets.length ? (
            <Carousel
              ref={carouselRef}
              autoPlayInterval={2000}
              data={[...wallets, { id: 'add', name: 'Add Wallet', type: 'Action', icon: '+' }]}
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
              data={[{ id: 'add', name: 'Add Wallet', type: 'Action', icon: '+' }]}
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

        <View className="mt-1 rounded-t-2xl bg-primary-muted">
          <View className="flex-row justify-between relative">
            <View className="h-15 w-12 left-12 rounded-b-4xl border-b-4 border-l-4 border-r-4 border-border bg-primary-soft bottom-1" />
            <View className="h-15 w-12 right-12 rounded-b-4xl border-b-4 border-l-4 border-r-4 border-border bg-primary-soft bottom-1" />
          </View>

          <View className="mt-1 rounded-t-2xl bg-background px-4 pb-8 pt-6">
            <View className="flex-row justify-between items-center mb-2">
              <Text className="text-sm font-semibold text-foreground">
                Recent Transactions
              </Text>
              <Link
                href={
                  (focusedWallet?.id
                    ? `/transaction/new?walletId=${focusedWallet.id}`
                    : '/transaction/new') as any
                }
                asChild>
                <TouchableOpacity className="rounded-lg bg-primary px-4 py-2">
                  <Text className="font-semibold text-primary-foreground">+ Add</Text>
                </TouchableOpacity>
              </Link>
            </View>
            {transactions.map((item) => {
              const isIncome = item.type === 'income';
              const isTransfer = item.type === 'transfer';
              const title = isTransfer
                ? formatTransferLabel(
                    {
                      wallet_id: item.walletId,
                      transfer_to_wallet_id: item.transferToWalletId,
                      type: item.type,
                    },
                    Object.fromEntries(wallets.map((w) => [w.id, w.name ?? 'Wallet'])),
                    focusedWallet?.id,
                  )
                : item.merchant || item.description || item.type;
              const amountClass = isTransfer
                ? 'text-sky-600'
                : isIncome
                  ? 'text-green-600'
                  : 'text-red-500';
              return (
                <Pressable
                  key={item.id}
                  accessibilityRole="button"
                  accessibilityHint="Opens transaction details"
                  onPress={() => {
                    router.push({ pathname: '/transaction/[id]', params: { id: item.id } });
                  }}
                  style={({ pressed }) => (pressed ? { opacity: 0.92 } : undefined)}
                  className="mb-2 rounded-xl border border-border bg-card p-3 shadow-sm">
                  <View className="flex-row items-start justify-between gap-2">
                    <View className="min-w-0 flex-1 pr-1">
                      <View className="flex-row items-baseline gap-1 flex-wrap">
                        <Text className={`text-base font-semibold ${amountClass}`}>
                          {isTransfer ? '' : isIncome ? '+' : '-'}
                          {item.amount.toFixed(2)}
                        </Text>
                        <Text className="text-xs text-muted">
                          {focusedWallet?.currency ?? 'USD'}
                        </Text>
                      </View>
                      <Text className="text-base text-foreground">{title}</Text>
                      <Text className="text-xs text-muted">
                        {new Date(item.transactionDate).toLocaleDateString()}
                      </Text>
                    </View>
                    <View className="flex items-center gap-0.5 pt-0.5">
                      <Pressable
                        accessibilityLabel="Delete transaction"
                        hitSlop={8}
                        onPress={() => handleDeleteTransaction(item.id)}
                        className="rounded p-1 active:opacity-70"
                      >
                        <MaterialIcons name="delete-outline" size={18} color={tokens.danger} />
                      </Pressable>
                    </View>
                  </View>
                </Pressable>
              );
            })}
            {transactions.length === 0 ? (
              <View className="mb-2 rounded-xl border border-dashed border-border bg-card p-4 shadow-sm">
                <Text className="text-center text-sm text-muted">
                  No transactions for this wallet yet. Tap + Add to create one.
                </Text>
              </View>
            ) : null}

            {focusedWallet && hasSvgViewManager ? (
              <>
                <View className="mt-6 rounded-xl bg-background-muted p-3">
                  <Text className="mb-2 text-base font-semibold text-foreground">
                    Expense categories ({focusedWallet.name})
                  </Text>
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

                <View className="mb-2 mt-6 rounded-xl bg-background-muted p-3">
                  <Text className="mb-2 text-base font-semibold text-foreground">
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
                        tickLabels: { fill: tokens.muted, fontSize: 10 },
                        axisLabel: { fill: tokens.muted, fontSize: 11, padding: 28 },
                      }}
                    />
                    <VictoryAxis
                      dependentAxis
                      label={`Balance (${focusedWallet.currency ?? 'USD'})`}
                      tickFormat={(tick) => `${Number(tick).toFixed(0)}`}
                      style={{
                        tickLabels: { fill: tokens.muted, fontSize: 10 },
                        axisLabel: { fill: tokens.muted, fontSize: 11, padding: 56 },
                      }}
                    />
                    <VictoryLine
                      data={walletBalanceLineData}
                      style={{ data: { stroke: tokens.primary, strokeWidth: 3 } }}
                    />
                    <VictoryScatter
                      data={walletBalanceLineData}
                      size={4}
                      style={{ data: { fill: tokens.primary } }}
                    />
                  </VictoryChart>
                </View>
              </>
            ) : null}

            {focusedWallet && !hasSvgViewManager ? (
              <View className="mt-6 rounded-xl border border-border bg-card p-4">
                <Text className="text-sm text-muted">
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
