import { useCallback, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { Link, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useAuth } from '@/lib/auth/auth-context';
import { getTransactions } from '@/lib/supabase/transactions';
import { getWallets } from '@/lib/supabase/wallets';
import { useProposedTransactions } from '@/hooks/use-proposed-transactions';
import { IconSymbol } from '@/components/ui/icon-symbol';
import type { ProposedTransaction } from '@repo/types';

type WalletItem = { id: string; name: string; currency: string };

function WalletPickerModal({
  visible,
  wallets,
  onSelect,
  onCancel,
}: {
  visible: boolean;
  wallets: WalletItem[];
  onSelect: (walletId: string) => void;
  onCancel: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide">
      <View className="flex-1 justify-end bg-black/50">
        <View className="bg-white dark:bg-gray-900 rounded-t-2xl p-6 pb-10">
          <Text className="text-base font-semibold text-gray-900 dark:text-white mb-4">
            Select wallet for this transaction
          </Text>
          {wallets.map((w) => (
            <TouchableOpacity
              key={w.id}
              className="flex-row items-center py-3 border-b border-gray-100 dark:border-gray-800"
              onPress={() => onSelect(w.id)}>
              <View className="flex-1">
                <Text className="text-sm font-medium text-gray-900 dark:text-white">{w.name}</Text>
                <Text className="text-xs text-gray-500 dark:text-gray-400">{w.currency}</Text>
              </View>
              <IconSymbol name="chevron.right" size={16} color="#9ca3af" />
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            className="mt-4 py-3 items-center rounded-lg bg-gray-100 dark:bg-gray-800"
            onPress={onCancel}>
            <Text className="text-sm font-medium text-gray-700 dark:text-gray-300">Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

function ProposalCard({
  item,
  onApprove,
  onReject,
}: {
  item: ProposedTransaction;
  onApprove: (p: ProposedTransaction) => void;
  onReject: (id: string) => void;
}) {
  const isExpense = item.type === 'expense' || !item.type;
  return (
    <View className="bg-white dark:bg-gray-800 rounded-lg p-4 mb-2 border border-gray-100 dark:border-gray-700">
      <View className="flex-row items-center justify-between mb-1">
        <Text className="text-xs font-semibold text-blue-600 dark:text-blue-400">
          {item.sourceApp || 'Unknown app'}
        </Text>
        <Text className="text-xs text-gray-500 dark:text-gray-400">
          {item.aiConfidence != null ? `${Math.round(item.aiConfidence * 100)}% confidence` : 'AI proposal'}
        </Text>
      </View>
      <Text
        className={`text-xl font-bold ${isExpense ? 'text-red-500 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
        {isExpense ? '−' : '+'}
        {item.currency ?? ''} {item.amount?.toFixed(2) ?? '—'}
      </Text>
      <Text className="text-sm mt-1 text-gray-900 dark:text-white" numberOfLines={1}>
        {item.merchant || item.description || item.type || 'Transaction'}
      </Text>
      <View className="flex-row gap-2 mt-3">
        <TouchableOpacity
          className="flex-1 flex-row items-center justify-center gap-1 py-2.5 rounded-lg bg-green-600 dark:bg-green-700"
          onPress={() => onApprove(item)}>
          <IconSymbol name="checkmark" size={14} color="white" />
          <Text className="text-white text-sm font-semibold">Approve</Text>
        </TouchableOpacity>
        <TouchableOpacity
          className="flex-1 flex-row items-center justify-center gap-1 py-2.5 rounded-lg bg-gray-100 dark:bg-gray-700"
          onPress={() => onReject(item.id)}>
          <IconSymbol name="xmark" size={14} color="#6b7280" />
          <Text className="text-gray-700 dark:text-gray-300 text-sm font-semibold">Reject</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function TransactionsScreen() {
  const { user } = useAuth();
  const { walletId } = useLocalSearchParams<{ walletId?: string }>();
  const [transactions, setTransactions] = useState<any[]>([]);
  const [wallets, setWallets] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [walletPickerVisible, setWalletPickerVisible] = useState(false);
  const [walletPickerWallets, setWalletPickerWallets] = useState<WalletItem[]>([]);
  const [pendingApproval, setPendingApproval] = useState<ProposedTransaction | null>(null);
  const {
    proposals,
    isLoading: proposalsLoading,
    approve,
    reject,
    reload: reloadProposals,
    fetchWallets,
  } = useProposedTransactions();

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
    await Promise.all([loadData(), reloadProposals()]);
    setRefreshing(false);
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
      reloadProposals();
    }, [loadData, reloadProposals])
  );

  const walletMap = Object.fromEntries(wallets.map((w) => [w.id, w]));

  const handleApprove = useCallback(
    async (proposal: ProposedTransaction) => {
      if (proposal.walletId) {
        try {
          await approve(proposal, proposal.walletId);
          Alert.alert('Approved', 'Transaction has been added to your records.');
        } catch (e) {
          Alert.alert('Error', e instanceof Error ? e.message : 'Failed to approve');
        }
        return;
      }

      setPendingApproval(proposal);
      const walletOptions = await fetchWallets();
      setWalletPickerWallets(
        walletOptions.map((w) => ({ id: w.id, name: w.name ?? '', currency: w.currency ?? 'USD' })),
      );
      setWalletPickerVisible(true);
    },
    [approve, fetchWallets],
  );

  const handleWalletSelected = useCallback(
    async (selectedWalletId: string) => {
      setWalletPickerVisible(false);
      if (!pendingApproval) return;
      try {
        await approve(pendingApproval, selectedWalletId);
        Alert.alert('Approved', 'Transaction has been added to your records.');
      } catch (e) {
        Alert.alert('Error', e instanceof Error ? e.message : 'Failed to approve');
      }
      setPendingApproval(null);
    },
    [approve, pendingApproval],
  );

  const handleReject = useCallback(
    (id: string) => {
      Alert.alert('Reject proposal', 'This will discard the AI-proposed transaction.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Reject', style: 'destructive', onPress: () => reject(id) },
      ]);
    },
    [reject],
  );

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
        ListHeaderComponent={
          <View>
            <View className="mb-3">
              <View className="flex-row items-center justify-between mb-2">
                <Text className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Pending Proposals
                </Text>
                {proposalsLoading ? <ActivityIndicator size="small" color="#6b7280" /> : null}
              </View>
              {proposals.length === 0 && !proposalsLoading ? (
                <View className="bg-gray-100 dark:bg-gray-800 rounded-lg p-4 mb-2 border border-dashed border-gray-200 dark:border-gray-700">
                  <Text className="text-sm text-gray-500 dark:text-gray-400 text-center">
                    No pending AI proposals.
                  </Text>
                </View>
              ) : (
                proposals.map((p) => (
                  <ProposalCard
                    key={p.id}
                    item={p}
                    onApprove={handleApprove}
                    onReject={handleReject}
                  />
                ))
              )}
            </View>
          </View>
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
          <Text className="text-center text-gray-600 dark:text-gray-400 mt-6">
            No transactions yet. Tap + Add to create one.
          </Text>
        }
      />
      <WalletPickerModal
        visible={walletPickerVisible}
        wallets={walletPickerWallets}
        onSelect={handleWalletSelected}
        onCancel={() => {
          setWalletPickerVisible(false);
          setPendingApproval(null);
        }}
      />
    </View>
  );
}

