import { useCallback, useState } from 'react';
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

const MAIN_WALLET_KEY = 'main_wallet_id';

export default function WalletsScreen() {
  const { user } = useAuth();
  const [wallets, setWallets] = useState<any[]>([]);
  const [balances, setBalances] = useState<Record<string, number>>({});
  const [refreshing, setRefreshing] = useState(false);
  const [mainWalletId, setMainWalletId] = useState<string | null>(null);

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
        storedMainWalletId = walletList[0].id;
        await mmkvStorage.setItem(MAIN_WALLET_KEY, storedMainWalletId);
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

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  return (
    <View className="flex-1 bg-white dark:bg-gray-900 pt-5">
      <View className="px-4 pt-4 pb-2 flex-1 flex-row items-center justify-between">
        <View className="flex-row items-center space-x-2">
          <View className="w-9 h-9 rounded-xl bg-blue-600 items-center justify-center">
            <Text className="text-base text-white font-bold">{mainWallet?.icon ?? 'W'}</Text>
          </View>
          <Text className="text-xl font-bold text-gray-900 dark:text-white">Wallets</Text>
        </View>
        <PowerSyncStatusIndicator />
      </View>

      <View className="bg-slate-100 flex-30 top-30">
        <View className="relative bottom-20 flex-2 flex-row items-center justify-between pl-5 pr-5">
          <View className="bg-slate-100 border border-slate-200/70 h-30 w-10 ">

          </View>
          <View className="  mt-25">
            <View className="bg-slate-200/20 dark:bg-slate-700/80 rounded-2xl shadow-sm absolute top-10 left-12 right-12 bottom-10 z-10" />
            <View className="bg-blue-600 dark:bg-blue-500 rounded-3xl p-4 h-44 overflow-hidden">
              <Text className="text-xs text-blue-100 font-medium">Main Wallet</Text>
              <View className="flex-row justify-between mt-3 items-center">
                <Text className="text-xl text-white font-bold">{mainWallet?.name ?? 'No wallet selected'}</Text>
                <View className="rounded-full bg-blue-500/70 px-2 py-1">
                  <Text className="text-xs text-white">{mainWallet?.type ?? '-'}</Text>
                </View>
              </View>
              <Text className="text-xs text-blue-100/90 mt-4">Current balance</Text>
              <Text className="text-3xl font-bold text-white mt-1">
                ${((mainWallet && (balances[mainWallet.id] ?? mainWallet.initialBalance)) ?? 0).toFixed(2)}
              </Text>
              <Text className="text-xs text-blue-100/90 mt-2">{mainWallet?.currency ?? 'USD'}</Text>
            </View>
          </View>
          <View className="bg-slate-100 border border-slate-200/70 h-30 w-10  ">

          </View>
        </View>

        <View className=" pl-8 pr-8 flex-3 relative bottom-20">
          <View className="h-px bg-slate-300 dark:bg-slate-700 mb-3" />
          <View className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-3 mb-2 flex-1 bottom-1">
            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">Other wallets</Text>
              <Link href={'/wallet/new' as any} asChild>
                <TouchableOpacity className="bg-blue-600 dark:bg-blue-500 px-4 py-1 rounded-lg">
                  <Text className="text-white font-semibold">+ Add</Text>
                </TouchableOpacity>
              </Link>
            </View>
            <FlatList
              style={{ flex: 1 }}
              data={wallets}
              numColumns={2}
              columnWrapperStyle={{ justifyContent: 'space-between', marginBottom: 10 }}
              keyExtractor={(item) => item.id}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
              ListEmptyComponent={() => (
                <View className="rounded-xl border border-dashed border-slate-300 dark:border-slate-600 px-3 py-4">
                  <Text className="text-center text-slate-500 dark:text-slate-300">No other wallets yet.</Text>
                </View>
              )}
              renderItem={({ item }) => {
                const balance = balances[item.id] ?? item.initialBalance ?? 0;
                const isMain = item.id === mainWallet?.id;
                return (
                  <View style={{ width: '48%' }} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-3 mb-2">
                    <TouchableOpacity
                      onPress={() => router.push(`/(tabs)/transactions?walletId=${item.id}` as any)}
                      className="flex-1"
                    >
                      <View className="flex-column items-start justify-between">
                        <View>
                          <Text className="text-sm font-semibold text-slate-900 dark:text-white">{item.name}</Text>
                          <Text className="text-xs text-slate-500 dark:text-slate-300">{item.type}</Text>
                        </View>
                        <Text className="text-sm font-semibold text-slate-900 dark:text-white">${balance.toFixed(2)}</Text>
                      </View>
                    </TouchableOpacity>
                    <View className="flex-row justify-between mt-2">
                      <TouchableOpacity
                        onPress={() => setAsMainWallet(item.id)}
                        className={`rounded-full px-2 py-1 ${isMain ? 'bg-green-100 border border-green-300' : 'bg-slate-100 border border-slate-300 dark:bg-slate-700 dark:border-slate-600'}`}
                      >
                        <Text className={`text-[10px] font-medium ${isMain ? 'text-green-700 dark:text-green-300' : 'text-slate-600 dark:text-slate-200'}`}>
                          {isMain ? 'Main wallet' : 'Set main'}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => handleDeleteWallet(item.id)}
                        className="rounded-full border border-red-300 bg-red-50 px-2 py-1"
                      >
                        <Text className="text-[10px] font-medium text-red-700">Delete</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              }}
              showsVerticalScrollIndicator={false}
            />
          </View>
        </View>
      </View>

      
    </View>
  );
}
