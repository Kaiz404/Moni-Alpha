import { useCallback, useRef, useState } from 'react';
import {
  Alert,
  View,
  Text,
  ScrollView,
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
  const [expandedWalletId, setExpandedWalletId] = useState<string | null>(null);
  const onViewableItemsChanged = useRef((info: any) => {
    const first = info.viewableItems?.[0];
    if (first?.index != null && first.index < wallets.length) {
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
    ({ item }: { item: any }) => {
      if (item.id === 'add') {
        return (
          <View className="w-72 h-[180px] rounded-3xl border border-dashed border-slate-300 dark:border-slate-600 bg-white/90 p-4 shadow-sm dark:bg-slate-800 relative">
            <TouchableOpacity
              onPress={() => router.push('/wallet/new' as any)}
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
        );
      }

      const balance = balances[item.id] ?? item.currentBalance ?? item.initialBalance ?? 0;
      const isMain = item.id === mainWallet?.id;

      return (
        <View className="w-72 h-[180px] rounded-3xl border border-slate-200 bg-[#8494FF] p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800 relative">
          <TouchableOpacity
            onPress={() =>
              router.push(`/(tabs)/transactions?walletId=${item.id}` as any)
            }
            activeOpacity={0.85}
          >
            <View className="flex-row items-start justify-between">
              <View className="flex-row items-center space-x-3 flex-1 ">
                <View
                  className="w-12 h-12 rounded-2xl items-center justify-center"
                  style={{ backgroundColor: "#FAFAFA" }}
                >
                  <Text className="text-base text-white font-bold">{item.icon ?? 'W'}</Text>
                </View>
                <View className="flex-1 ml-2">
                  <Text className="text-xs font-semibold uppercase tracking-[0.05em] text-[#FAFAFA] dark:text-blue-400">
                    {item.type ?? 'Wallet'}
                  </Text>
                  <Text className="text-lg font-bold text-[#FAFAFA] dark:text-white">
                    {item.name}
                  </Text>
                  <Text className="text-xs text-[#FAFAFA]/80 dark:text-slate-300">
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
                      <Text className="text-xs font-semibold text-slate-500">✕</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => setAsMainWallet(item.id)}
                      className={`rounded-full px-2 py-1 border ${
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
                        {isMain ? 'Main' : 'Set'}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => handleDeleteWallet(item.id)}
                      className="rounded-full border border-red-300 bg-red-50 px-2 py-1"
                    >
                      <Text className="text-xs font-semibold text-red-700">Del</Text>
                    </TouchableOpacity>

                    
                  </View>
                ) : (
                  <TouchableOpacity
                    onPress={() => setExpandedWalletId(item.id)}
                    className="rounded-full bg-slate-100 dark:bg-slate-700 px-2.5 py-1.5"
                  >
                    <Text className="text-sm font-semibold text-slate-600 dark:text-slate-300">⋯</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            <View className="mt-4 top-3">
              <Text className="text-xs text-[#FAFAFA]/80 dark:text-slate-300">Balance</Text>
              <Text className="mt-1 text-3xl font-bold text-[#FAFAFA] dark:text-white">
                ${balance.toFixed(2)}
              </Text>
            </View>
          </TouchableOpacity>
        </View>
      );
    },
    [balances, handleDeleteWallet, mainWallet?.id, setAsMainWallet, expandedWalletId, setExpandedWalletId]
  );

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const ref = React.useRef<ICarouselInstance>(null);

  return (
    <View className="flex-1 bg-white dark:bg-gray-900 pt-5">
      <View className="px-4 pt-4 pb-2 flex-1 flex-row items-center justify-between">
        <View className="flex-row items-center space-x-2">
          <View className="w-9 h-9 rounded-xl bg-slate-200 items-center justify-center">
            <Text className="text-base text-white font-bold">{mainWallet?.icon ?? 'W'}</Text>
          </View>
          <Text className="text-2xl ml-3 font-bold text-gray-900 dark:text-white">Wallets</Text>
        </View>
        <PowerSyncStatusIndicator />
      </View>
      <View
        id="carousel-component"
        className="left-10 right-5 top-8"
      >
        {wallets.length ? (
          <Carousel
            ref={ref}
            autoPlayInterval={2000}
            data={[...wallets, { id: 'add', name: 'Add Wallet', type: 'Action', icon: '+', color: '#10b981' }]}
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
            onSnapToItem={(index) => {
              // Include Add card as final indicator dot
              setActiveWalletIndex(index);
            }}
            customConfig={() => ({ type: "positive", viewCount: Math.min(wallets.length + 1, 5) || 1 })}
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
            customConfig={() => ({ type: "positive", viewCount: 1 })}
            renderItem={renderWalletCarouselItem}
          />
        )}
      </View>
      
      <View className="mt-5 mb-2 flex-row flex-1 items-center justify-center space-x-2">
        {Array.from({ length: wallets.length + 1 }, (_, index) => {
          const isActive = index === activeWalletIndex;
          return (
            <View
              key={`wallet-dot-${index}`}
              className={`h-2 ml-1 ${isActive ? 'w-6 bg-[#8494FF]' : 'w-2 bg-slate-300 dark:bg-slate-500'} rounded-full `}
            />
          );
        })}
      </View>
      
      <View className="bg-[#6367FF]/70 flex-12 rounded-t-2xl">
        <View className='flex-row justify-between relative'>
          <View className="h-15 w-12 left-12 rounded-b-4xl border-l-4 border-r-4 border-b-4 border-[#EDEDED] bg-[#9EADFF] bottom-1"/>
          <View className="h-15 w-12 right-12 rounded-b-4xl border-l-4 border-r-4 border-b-4 border-[#EDEDED] bg-[#9EADFF] bottom-1"/>
        </View>

        <ScrollView
          contentContainerStyle={{ paddingBottom: 36 }}
          className="bg-[#FAFAFA]/80 mt-1 rounded-t-2xl"
          style={{ flex: 1 }}
        >
          <View className="px-4 pt-6">
            <Text className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-200">Transactions List</Text>
            {[
              { id: 't1', title: 'Test item #1' },
              { id: 't2', title: 'Test item #2' },
              { id: 't3', title: 'Test item #3' },
              { id: 't4', title: 'Test item #4' },
              { id: 't5', title: 'Test item #5' },
              { id: 't6', title: 'Test item #6' },
              { id: 't7', title: 'Test item #7' },
              { id: 't8', title: 'Test item #8' },
              { id: 't9', title: 'Test item #9' },
            ].map((item) => (
              <View
                key={item.id}
                className="mb-2 rounded-xl border border-slate-300 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-800"
              >
                <Text className="text-base text-slate-900 dark:text-white">{item.title}</Text>
              </View>
            ))}

            <View className="mt-6">
              <View className="bg-[#8494FF] rounded-xl h-50">
                <Text>
                  some chart idk
                </Text>
              </View>
            </View>
            <View className="mt-6">
              <View className="bg-[#8494FF] rounded-xl h-50">
                <Text>
                  some chart idk
                </Text>
              </View>
            </View>
            <View className="mt-6">
              <View className="bg-[#8494FF] rounded-xl h-50">
                <Text>
                  some chart idk
                </Text>
              </View>
            </View>
          </View>
        </ScrollView>
      </View>
      
    </View>
  );
}
