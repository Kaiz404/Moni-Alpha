import { useCallback, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, RefreshControl } from 'react-native';
import { Link, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useAuth } from '@/lib/auth/auth-context';
import { getTransactions } from '@/lib/supabase/transactions';
import { getWallets } from '@/lib/supabase/wallets';

export default function TransactionsScreen() {
  const { user } = useAuth();
  const { walletId } = useLocalSearchParams<{ walletId?: string }>();
  const [transactions, setTransactions] = useState<any[]>([]);
  const [wallets, setWallets] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    if (!user) return;

    try {
      const [txData, walletData] = await Promise.all([
        getTransactions(walletId),
        getWallets(),
      ]);

      setTransactions(txData);
      setWallets(walletData);
    } catch (error) {
      console.error('Error loading transactions:', error);
    }
  }, [user, walletId]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const walletMap = Object.fromEntries(wallets.map((w) => [w.id, w]));

  return (
    <View className="flex-1 p-4 bg-white dark:bg-gray-900">
      <View className="flex-row justify-between items-center mb-4">
        <Text className="text-2xl font-semibold text-gray-900 dark:text-white">
          {walletId ? walletMap[walletId]?.name ?? 'Transactions' : 'All Transactions'}
        </Text>
        <Link href={(walletId ? `/transaction/new?walletId=${walletId}` : '/transaction/new') as any} asChild>
          <TouchableOpacity className="bg-blue-600 dark:bg-blue-500 px-4 py-2 rounded-lg">
            <Text className="text-white font-semibold">+ Add</Text>
          </TouchableOpacity>
        </Link>
      </View>
      <FlatList
        data={transactions}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        renderItem={({ item }) => (
          <View className="bg-gray-100 dark:bg-gray-800 rounded-lg p-4 mb-2">
            <View className="flex-row items-baseline gap-1">
              <Text className={`text-lg font-semibold ${item.type === 'income' ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>
                {item.type === 'income' ? '+' : '-'}
                {item.amount.toFixed(2)}
              </Text>
              <Text className="text-sm text-gray-600 dark:text-gray-400">{walletMap[item.walletId]?.currency ?? 'USD'}</Text>
            </View>
            <Text className="text-sm mt-1 text-gray-900 dark:text-white">
              {item.merchant || item.description || item.type}
            </Text>
            <Text className="text-xs text-gray-600 dark:text-gray-400 mt-1">
              {new Date(item.transactionDate).toLocaleDateString()} •{' '}
              {walletMap[item.walletId]?.name ?? 'Wallet'}
            </Text>
          </View>
        )}
        ListEmptyComponent={
          <Text className="text-center text-gray-600 dark:text-gray-400 mt-6">No transactions yet. Tap + Add to create one.</Text>
        }
      />
    </View>
  );
}
