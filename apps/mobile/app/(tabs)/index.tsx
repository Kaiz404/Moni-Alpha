import { useCallback, useRef, useState } from 'react';
import {
  Alert,
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { Link, router, useFocusEffect } from 'expo-router';
import { useAuth } from '@/lib/auth/auth-context';
import { mmkvStorage } from '@/lib/storage/mmkv-storage';
import { getWallets, deleteWallet } from '@/lib/supabase/wallets';
import { getWalletBalances } from '@/lib/supabase/balances';
import { PowerSyncStatusIndicator } from '@/components/power-sync-status-indicator';
import * as React from "react";
import type { ICarouselInstance } from "react-native-reanimated-carousel";
import Carousel from "react-native-reanimated-carousel";

const MAIN_WALLET_KEY = 'main_wallet_id';

export default function WalletsScreen() {
  const { user } = useAuth();
  const [wallets, setWallets] = useState<any[]>([]);
  const [balances, setBalances] = useState<Record<string, number>>({});
  const [refreshing, setRefreshing] = useState(false);
  const [mainWalletId, setMainWalletId] = useState<string | null>(null);
  const [activeWalletIndex, setActiveWalletIndex] = useState(0);
  const onViewableItemsChanged = useRef((info: any) => {
    const first = info.viewableItems?.[0];
    if (first?.index != null) {
      setActiveWalletIndex(first.index);
    }
  }).current;

  const mainWallet = wallets.find((w) => w.id === mainWalletId) ?? wallets[0] ?? null;

  const loadData = useCallback(async () => {
    if (!user) return;

    try {
      const [walletsData] = await Promise.all([
        getWallets(),
        getWalletBalances([]),
      ]);
      const walletList = walletsData || [];
      setWallets(walletList);
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
      setMainWalletId(storedMainWalletId ?? walletList[0]?.id ?? null);
    } catch (error) {
      console.error('Error loading wallets:', error);
    }
  }, [user]);

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
        'This will permanently delete the wallet and its local transactions. Continue?',
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
    ({ item }: { item: any }) => {
      const balance = balances[item.id] ?? item.currentBalance ?? item.initialBalance ?? 0;
      const isMain = item.id === mainWallet?.id;

      return (
        <View className="w-72 h-[220px] rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800 relative">
          <TouchableOpacity
            onPress={() =>
              router.push(`/(tabs)/transactions?walletId=${item.id}` as any)
            }
            activeOpacity={0.85}
          >
            <View className="flex-row items-start justify-between">
              <View className="flex-row items-center space-x-3">
                <View
                  className="w-11 h-11 rounded-2xl items-center justify-center"
                  style={{ backgroundColor: item.color ?? '#3b82f6' }}
                >
                  <Text className="text-base text-white font-bold">{item.icon ?? 'W'}</Text>
                </View>
                <View>
                  <Text className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600 dark:text-blue-400">
                    {item.type ?? 'Wallet'}
                  </Text>
                  <Text className="mt-1 text-lg font-bold text-slate-900 dark:text-white">
                    {item.name}
                  </Text>
                  <Text className="mt-1 text-xs text-slate-500 dark:text-slate-300">
                    {item.currency ?? 'USD'}
                  </Text>
                </View>
              </View>

              {isMain ? (
                <View className="rounded-full bg-green-600 px-3 py-1">
                  <Text className="text-xs font-semibold text-white">Main</Text>
                </View>
              ) : null}
            </View>

            <View className="mt-4">
              <Text className="text-xs text-slate-500 dark:text-slate-300">Balance</Text>
              <Text className="mt-1 text-3xl font-bold text-slate-900 dark:text-white">
                ${balance.toFixed(2)}
              </Text>
            </View>
          </TouchableOpacity>

          <View className="mt-3 flex-row justify-between items-center">
            <TouchableOpacity
              onPress={() => setAsMainWallet(item.id)}
              className={`rounded-full px-3 py-2 border ${
                isMain
                  ? 'bg-green-600 border-green-600'
                  : 'bg-slate-100 border-slate-300 dark:bg-slate-700 dark:border-slate-600'
              }`}
            >
              <Text
                className={`text-xs font-semibold ${
                  isMain ? 'text-white' : 'text-slate-700 dark:text-slate-200'
                }`}
              >
                {isMain ? 'Main wallet' : 'Set main'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => handleDeleteWallet(item.id)}
              className="rounded-full border border-red-300 bg-red-50 px-3 py-2"
            >
              <Text className="text-xs font-semibold text-red-700">Delete</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    },
    [balances, handleDeleteWallet, mainWallet?.id, setAsMainWallet]
  );

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const ref = React.useRef<ICarouselInstance>(null);

  return (
    <View className="flex-1 bg-white dark:bg-gray-900 pt-5">
      <View className="px-4 pt-4 pb-2 flex-3 flex-row items-center justify-between">
        <View className="flex-row items-center space-x-2">
          <View className="w-9 h-9 rounded-xl bg-blue-600 items-center justify-center">
            <Text className="text-base text-white font-bold">{mainWallet?.icon ?? 'W'}</Text>
          </View>
          <Text className="text-xl font-bold text-gray-900 dark:text-white">Wallets</Text>
        </View>
        <PowerSyncStatusIndicator />
      </View>
      <View
        id="carousel-component"
        className=""
      >
        {wallets.length ? (
          <Carousel
            ref={ref}
            autoPlayInterval={2000}
            data={wallets}
            loop={true}
            pagingEnabled={true}
            snapEnabled={true}
            width={430 * 0.75}
            height={220}
            style={{
              width: 430 * 0.75,
              height: 220,
              alignItems: "center",
              justifyContent: "center",
            }}
            mode={"horizontal-stack"}
            modeConfig={{
              snapDirection: "left",
              stackInterval: 18,
            }}
            customConfig={() => ({ type: "positive", viewCount: Math.min(wallets.length, 5) || 1 })}
            renderItem={renderWalletCarouselItem}
          />
        ) : (
          <View className="mx-2 w-72 rounded-xl border border-dashed border-slate-300 dark:border-slate-600 bg-white/60 p-4">
            <Text className="text-center text-slate-500 dark:text-slate-300">No wallets yet.</Text>
          </View>
        )}
      </View>
      <View className="mt-2 flex-row flex-1 items-center justify-center space-x-2">
        {wallets.map((wallet, index) => (
          <View
            key={wallet.id}
            className={`h-2 ${index === activeWalletIndex ? 'w-6 bg-blue-600' : 'w-2 bg-slate-300 dark:bg-slate-500'} rounded-full`}
          />
        ))}
      </View>
      <View className="bg-slate-100 flex-20">
        
       

        <View className=" pl-8 pr-8 flex-3 ">
          <View className="h-px bg-slate-300 dark:bg-slate-700 mb-3" />
          <Link href={'/wallet/new' as any} asChild>
            <TouchableOpacity className="bg-blue-600 dark:bg-blue-500 px-4 py-1 rounded-lg">
              <Text className="text-white font-semibold">+ Add</Text>
            </TouchableOpacity>
          </Link>
          
        </View>
      </View>

      
    </View>
  );
}
