import { useMemo, useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { Link, router, useLocalSearchParams } from 'expo-router';
import MaterialIcons from '@react-native-vector-icons/material-icons';
import { useValue } from '@legendapp/state/react';
import { FinanceState } from '@/components/finance/finance-state';
import { GradientCard } from '@/components/ui/gradient-card';
import { getWalletCardStyle } from '@/constants/wallet-card-styles';
import { useAuth } from '@/lib/auth/auth-context';
import { formatMinorAmount } from '@/lib/finance/money';
import { categoryNameMap$, pendingProposals$, transactions$, walletBalanceMinor$, walletById$, walletsForUser$ } from '@/lib/finance/selectors';
import { deleteTransaction } from '@/lib/supabase/transactions';

export default function TransactionsScreen() {
  const { user } = useAuth();
  const params = useLocalSearchParams<{ walletId?: string | string[]; categoryId?: string | string[]; currency?: string | string[]; month?: string | string[] }>();
  const walletId = Array.isArray(params.walletId) ? params.walletId[0] : params.walletId;
  const categoryId = Array.isArray(params.categoryId) ? params.categoryId[0] : params.categoryId;
  const currency = Array.isArray(params.currency) ? params.currency[0] : params.currency;
  const month = Array.isArray(params.month) ? params.month[0] : params.month;
  const rows = useValue(transactions$({ userId: user?.id ?? null, walletId, categoryId, currency, month }));
  const wallets = useValue(walletsForUser$(user?.id ?? null));
  const categories = useValue(categoryNameMap$(user?.id ?? null));
  const proposals = useValue(pendingProposals$(user?.id ?? null));
  const selectedWallet = useValue(walletId ? walletById$(walletId) : walletById$(''));
  const selectedBalance = useValue(walletId ? walletBalanceMinor$(walletId) : walletBalanceMinor$(''));
  const [refreshing, setRefreshing] = useState(false);
  const walletNames = useMemo(() => Object.fromEntries(wallets.map((wallet) => [wallet.id, wallet.name])), [wallets]);
  const stats = useMemo(() => rows.reduce((all, row) => ({
    income: all.income + (row.type === 'income' ? Number(row.amountMinor) : 0),
    expense: all.expense + (row.type === 'expense' ? Number(row.amountMinor) : 0),
  }), { income: 0, expense: 0 }), [rows]);
  const onRefresh = async () => {
    setRefreshing(true);
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    setRefreshing(false);
  };
  const remove = (id: string) => Alert.alert('Delete transaction', 'This will remove the transaction from your records.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete', style: 'destructive', onPress: () => void deleteTransaction(id) },
  ]);

  return (
    <View className="flex-1 bg-background">
      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />} contentContainerClassName="p-4 pb-8">
        <View className="mb-4">
          {selectedWallet ? (
            <GradientCard cardStyle={getWalletCardStyle(selectedWallet.cardStyleId ?? undefined)} className="rounded-3xl p-4">
              <Text className="text-sm text-white/80">{selectedWallet.name}</Text>
              <Text className="mt-1 text-2xl font-bold text-white">{formatMinorAmount(selectedBalance, selectedWallet.currency)}</Text>
              <View className="mt-3 flex-row gap-4">
                <Text className="text-white">+{formatMinorAmount(stats.income, selectedWallet.currency)}</Text>
                <Text className="text-white">−{formatMinorAmount(stats.expense, selectedWallet.currency)}</Text>
              </View>
            </GradientCard>
          ) : (
            <View className="rounded-2xl border border-border bg-card p-4">
              <Text className="font-semibold text-foreground">{rows.length} transactions</Text>
              <Text className="mt-1 text-sm text-muted">All wallet currencies remain separate in analytics.</Text>
            </View>
          )}
        </View>

        {proposals.length ? <View className="mb-4">
          <Text className="mb-2 text-xs font-bold uppercase tracking-wider text-muted">Pending proposals</Text>
          {proposals.map((proposal) => <Pressable key={proposal.id} className="mb-2 rounded-2xl border border-border bg-card p-3" onPress={() => router.push({ pathname: '/proposal/[id]', params: { id: proposal.id } } as any)}>
            <View className="flex-row justify-between">
              <Text className="font-semibold text-foreground">{proposal.merchant ?? proposal.description ?? 'AI proposal'}</Text>
              <Text className="font-bold text-primary">{proposal.amountMinor == null ? 'Choose amount' : formatMinorAmount(proposal.amountMinor, proposal.currency)}</Text>
            </View>
          </Pressable>)}
        </View> : null}

        <View className="mb-2 flex-row items-center justify-between">
          <Text className="text-base font-semibold text-foreground">Recent transactions</Text>
          <Link href={walletId ? `/transaction/new?walletId=${walletId}` as any : '/transaction/new' as any} asChild>
            <TouchableOpacity className="rounded-lg bg-primary px-4 py-2"><Text className="font-semibold text-white">+ Add</Text></TouchableOpacity>
          </Link>
        </View>
        {rows.length === 0 ? <FinanceState title="No transactions yet" detail="Add an income, expense, or transfer to start your ledger." /> : rows.map((row) => {
          const transfer = row.type === 'transfer';
          const sign = transfer ? '' : row.type === 'income' ? '+' : '−';
          return <Pressable key={row.id} className="mb-2 rounded-2xl border border-border bg-card p-3" onPress={() => router.push(row.debtActivityId ? '/debts' as any : { pathname: '/transaction/[id]', params: { id: row.id } } as any)}>
            <View className="flex-row justify-between">
              <View className="flex-1 pr-2">
                <Text className="font-semibold text-foreground">{transfer ? `${walletNames[row.walletId] ?? 'Wallet'} → ${walletNames[row.transferToWalletId ?? ''] ?? 'Wallet'}` : row.merchant ?? row.description ?? row.type}</Text>
                <Text className="mt-1 text-xs text-muted">{new Date(row.transactionDate).toLocaleString()}{row.categoryId ? ` · ${categories[row.categoryId] ?? 'Uncategorized'}` : ''}</Text>
              </View>
              <View className="items-end">
                <Pressable hitSlop={8} onPress={() => remove(row.id)}><MaterialIcons name="delete-outline" size={17} color="#ef4444" /></Pressable>
                <Text className={`mt-1 font-bold ${transfer ? 'text-transfer' : row.type === 'income' ? 'text-income' : 'text-expense'}`}>{sign}{formatMinorAmount(row.amountMinor, row.currency)}</Text>
              </View>
            </View>
          </Pressable>;
        })}
      </ScrollView>
    </View>
  );
}
