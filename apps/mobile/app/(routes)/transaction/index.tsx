import { useCallback, useMemo, useState } from 'react';
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
import { syncSystem } from '@/lib/powersync/Powersync';
import type { ProposedTransaction } from '@repo/types';

type WalletItem = { id: string; name: string; currency: string };

type TxRow = {
  id: string;
  walletId: string;
  amount: number;
  type: string;
  categoryId?: string | null;
  merchant?: string | null;
  description?: string | null;
  notes?: string | null;
  transactionDate: string;
};

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
              <IconSymbol name="chevron-right" size={16} color="#9ca3af" />
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
          <IconSymbol name="check" size={14} color="white" />
          <Text className="text-white text-sm font-semibold">Approve</Text>
        </TouchableOpacity>
        <TouchableOpacity
          className="flex-1 flex-row items-center justify-center gap-1 py-2.5 rounded-lg bg-gray-100 dark:bg-gray-700"
          onPress={() => onReject(item.id)}>
          <IconSymbol name="close" size={14} color="#6b7280" />
          <Text className="text-gray-700 dark:text-gray-300 text-sm font-semibold">Reject</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function formatMoney(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: currency.length === 3 ? currency : 'USD',
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

export default function TransactionsScreen() {
  const { user } = useAuth();
  const params = useLocalSearchParams<{ walletId?: string | string[] }>();
  const walletId = useMemo(() => {
    const w = params.walletId;
    if (Array.isArray(w)) return w[0];
    return w;
  }, [params.walletId]);

  const [transactions, setTransactions] = useState<TxRow[]>([]);
  const [wallets, setWallets] = useState<any[]>([]);
  const [categoryMap, setCategoryMap] = useState<Record<string, string>>({});
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
      const [txData, walletData, categoryRows] = await Promise.all([
        getTransactions(walletId),
        getWallets(),
        syncSystem.db
          .selectFrom('categories')
          .select(['id', 'name'])
          .where('is_active', '=', 1)
          .execute(),
      ]);

      setTransactions(txData as TxRow[]);
      setWallets(walletData);
      setCategoryMap(
        Object.fromEntries(categoryRows.map((row) => [row.id, row.name ?? 'Uncategorized'])),
      );
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
    }, [loadData, reloadProposals]),
  );

  const walletMap = useMemo(
    () => Object.fromEntries(wallets.map((w) => [w.id, w])),
    [wallets],
  );

  const selectedWallet = walletId ? walletMap[walletId] : null;

  const listStats = useMemo(() => {
    let income = 0;
    let expense = 0;
    for (const t of transactions) {
      if (t.type === 'income') income += t.amount;
      else if (t.type === 'expense') expense += t.amount;
    }
    return { income, expense, count: transactions.length };
  }, [transactions]);

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

  const currency = selectedWallet?.currency ?? 'USD';

  const listHeader = useMemo(
    () => (
      <View className="pb-2">
        {selectedWallet ? (
          <View className="mb-4 rounded-2xl border border-indigo-200/80 bg-[#8494FF] p-4 dark:border-indigo-500/40 dark:bg-[#4f54c4]">
            <View className="flex-row items-start justify-between">
              <View className="flex-row items-center flex-1">
                <View className="w-12 h-12 rounded-2xl items-center justify-center bg-white/25">
                  <Text className="text-lg font-bold text-white">{selectedWallet.icon ?? 'W'}</Text>
                </View>
                <View className="ml-3 flex-1">
                  <Text className="text-xs font-semibold uppercase tracking-wide text-white/90">
                    {selectedWallet.type ?? 'Wallet'}
                  </Text>
                  <Text className="text-xl font-bold text-white">{selectedWallet.name}</Text>
                  <Text className="text-sm text-white/85">{selectedWallet.currency ?? 'USD'}</Text>
                </View>
              </View>
            </View>
            <View className="mt-4 border-t border-white/20 pt-4">
              <Text className="text-xs font-medium text-white/80">Current balance</Text>
              <Text className="text-2xl font-bold text-white mt-0.5">
                {formatMoney(
                  Number(selectedWallet.currentBalance ?? selectedWallet.initialBalance ?? 0),
                  currency,
                )}
              </Text>
            </View>
            <View className="mt-4 flex-row gap-3">
              <View className="flex-1 rounded-xl bg-white/15 px-3 py-2">
                <Text className="text-[11px] font-medium uppercase text-white/75">Income (list)</Text>
                <Text className="text-base font-semibold text-emerald-200">
                  {formatMoney(listStats.income, currency)}
                </Text>
              </View>
              <View className="flex-1 rounded-xl bg-white/15 px-3 py-2">
                <Text className="text-[11px] font-medium uppercase text-white/75">Expenses (list)</Text>
                <Text className="text-base font-semibold text-rose-200">
                  {formatMoney(listStats.expense, currency)}
                </Text>
              </View>
            </View>
            <Text className="text-[11px] text-white/70 mt-3">
              Totals reflect the transactions below (up to 100 most recent). Transfers are excluded from
              income/expense sums.
            </Text>
          </View>
        ) : (
          <View className="mb-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/80">
            <Text className="text-sm font-medium text-slate-500 dark:text-slate-400">All wallets</Text>
            <Text className="text-lg font-bold text-slate-900 dark:text-white mt-1">
              {listStats.count} transaction{listStats.count === 1 ? '' : 's'} loaded
            </Text>
            <Text className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Open a wallet from Wallets to filter by account and see balance.
            </Text>
          </View>
        )}

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

        <View className="flex-row justify-between items-center mb-3">
          <Text className="text-xl font-semibold text-gray-900 dark:text-white">
            {walletId ? selectedWallet?.name ?? 'Transactions' : 'All transactions'}
          </Text>
          <Link
            href={(walletId ? `/transaction/new?walletId=${walletId}` : '/transaction/new') as any}
            asChild>
            <TouchableOpacity className="bg-blue-600 dark:bg-blue-500 px-4 py-2 rounded-lg">
              <Text className="text-white font-semibold">+ Add</Text>
            </TouchableOpacity>
          </Link>
        </View>
      </View>
    ),
    [
      selectedWallet,
      walletId,
      listStats,
      proposals,
      proposalsLoading,
      handleApprove,
      handleReject,
      currency,
    ],
  );

  return (
    <View className="flex-1 bg-white dark:bg-gray-900">
      <FlatList
        data={transactions}
        keyExtractor={(item) => item.id}
        contentContainerClassName="px-4 pb-8 pt-2"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListHeaderComponent={listHeader}
        renderItem={({ item }) => {
          const isIncome = item.type === 'income';
          const categoryLabel = item.categoryId ? categoryMap[item.categoryId] : null;
          return (
            <View className="bg-gray-100 dark:bg-gray-800 rounded-xl p-4 mb-2 border border-gray-200/80 dark:border-gray-700/80">
              <View className="flex-row items-start justify-between gap-2">
                <View className="flex-1 min-w-0">
                  <Text className="text-base font-semibold text-gray-900 dark:text-white" numberOfLines={2}>
                    {item.merchant || item.description || item.type}
                  </Text>
                  {item.description && item.merchant ? (
                    <Text className="text-sm text-gray-600 dark:text-gray-400 mt-0.5" numberOfLines={2}>
                      {item.description}
                    </Text>
                  ) : null}
                  <View className="flex-row flex-wrap items-center gap-x-2 gap-y-1 mt-2">
                    <Text className="text-xs text-gray-500 dark:text-gray-400">
                      {new Date(item.transactionDate).toLocaleString(undefined, {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })}
                    </Text>
                    {categoryLabel ? (
                      <View className="rounded-full bg-slate-200/90 px-2 py-0.5 dark:bg-slate-600/90">
                        <Text className="text-[11px] font-medium text-slate-700 dark:text-slate-200">
                          {categoryLabel}
                        </Text>
                      </View>
                    ) : null}
                    <Text className="text-xs text-gray-500 dark:text-gray-400">
                      {walletMap[item.walletId]?.name ?? 'Wallet'}
                    </Text>
                  </View>
                  {item.notes ? (
                    <Text className="text-xs text-gray-500 dark:text-gray-400 mt-1 italic" numberOfLines={2}>
                      {item.notes}
                    </Text>
                  ) : null}
                </View>
                <View className="items-end shrink-0">
                  <Text
                    className={`text-lg font-bold ${isIncome ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>
                    {isIncome ? '+' : '−'}
                    {item.amount.toFixed(2)}
                  </Text>
                  <Text className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    {walletMap[item.walletId]?.currency ?? 'USD'}
                  </Text>
                </View>
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          <Text className="text-center text-gray-600 dark:text-gray-400 mt-6 px-2">
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
