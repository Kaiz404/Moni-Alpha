import { useCallback, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { Link, router } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '@/lib/auth/auth-context';
import { getWallets } from '@/lib/supabase/wallets';
import { getWalletBalances } from '@/lib/supabase/balances';

export default function WalletsScreen() {
  const { user } = useAuth();
  const [wallets, setWallets] = useState<any[]>([]);
  const [balances, setBalances] = useState<Record<string, number>>({});
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    if (!user) return;

    try {
      const [walletsData, balancesData] = await Promise.all([
        getWallets(),
        getWalletBalances([]), // We'll get balances for all wallets
      ]);

      setWallets(walletsData);

      // Get balances for all loaded wallets
      const walletIds = walletsData.map(w => w.id);
      const balancesDataFiltered = await getWalletBalances(walletIds);
      setBalances(balancesDataFiltered);
    } catch (error) {
      console.error('Error loading wallets:', error);
    }
  }, [user]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  return (
    <View className="flex-1 p-4 bg-white dark:bg-gray-900">
      <View className="flex-row justify-between items-center mb-4">
        <Text className="text-2xl font-semibold text-gray-900 dark:text-white">Wallets</Text>
        <Link href={'/wallet/new' as any} asChild>
          <TouchableOpacity className="bg-blue-600 dark:bg-blue-500 px-4 py-2 rounded-lg">
            <Text className="text-white font-semibold">+ Add</Text>
          </TouchableOpacity>
        </Link>
      </View>
      <FlatList
        data={wallets}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            className="bg-gray-100 dark:bg-gray-800 rounded-lg p-4 mb-2"
            onPress={() => router.push(`/(tabs)/transactions?walletId=${item.id}` as any)}
          >
            <View className="flex-row items-center">
              <Text className="text-2xl mr-3 text-gray-900 dark:text-white">{item.icon}</Text>
              <View className="flex-1">
                <Text className="text-base font-semibold text-gray-900 dark:text-white">{item.name}</Text>
                <Text className="text-xs text-gray-600 dark:text-gray-400 mt-1">{item.type}</Text>
              </View>
              <Text className="text-base font-semibold text-gray-900 dark:text-white">
                {item.currency} {(balances[item.id] ?? item.initialBalance).toFixed(2)}
              </Text>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <Text className="text-center text-gray-600 dark:text-gray-400 mt-6">No wallets yet. Tap + Add to create one.</Text>
        }
      />
    </View>
  );
}

