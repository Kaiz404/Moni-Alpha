import { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  ActivityIndicator,
  Pressable,
} from 'react-native';
import { Link, router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import MaterialIcons from '@react-native-vector-icons/material-icons';
import { useAuth } from '@/lib/auth/auth-context';
import { GradientCard } from '@/components/ui/gradient-card';
import { getWalletCardStyle } from '@/constants/wallet-card-styles';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { deleteTransaction, getTransactions } from '@/lib/supabase/transactions';
import { formatTransferLabel } from '@/lib/supabase/transaction-balance';
import { getWallets } from '@/lib/supabase/wallets';
import { getDefaultWalletId } from '@/lib/wallets/default-wallet';
import { resolveInitialWalletId } from '@/lib/wallets/proposal-wallet';
import { useProposedTransactions } from '@/hooks/use-proposed-transactions';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { ProposalCard } from '@/components/transaction/proposal-card';
import { WalletPickerModal } from '@/components/transaction/wallet-picker-modal';
import { getCategoryNameRows } from '@/lib/supabase/categories';
import type { ProposedTransaction } from '@repo/types';

type WalletItem = { id: string; name: string; currency: string };
type TxRow = { id: string; walletId: string; transferToWalletId: string | null; amount: number; currency: string; type: 'income' | 'expense' | 'transfer'; categoryId: string | null; merchant: string | null; description: string | null; notes: string | null; transactionDate: string; debtActivityId: string | null; analysisExcluded: boolean };

type WalletPickerFlow =
  | { proposal: ProposedTransaction; step: 'single' }
  | { proposal: ProposedTransaction; step: 'transfer-source' }
  | {
    proposal: ProposedTransaction;
    step: 'transfer-destination';
    sourceWalletId: string;
    sourceCurrency: string;
  };

function walletPickerTitle(flow: WalletPickerFlow | null): string {
  if (!flow) return 'Select wallet for this transaction';
  if (flow.step === 'single') return 'Select wallet for this transaction';
  if (flow.step === 'transfer-source') return 'Select source wallet';
  return 'Select destination wallet';
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
  const tokens = useThemeTokens();
  const params = useLocalSearchParams<{ walletId?: string | string[]; categoryId?: string | string[]; currency?: string | string[]; month?: string | string[] }>();
  const walletId = useMemo(() => {
    const w = params.walletId;
    if (Array.isArray(w)) return w[0];
    return w;
  }, [params.walletId]);
  const categoryId = useMemo(() => Array.isArray(params.categoryId) ? params.categoryId[0] : params.categoryId, [params.categoryId]);
  const currencyFilter = useMemo(() => Array.isArray(params.currency) ? params.currency[0] : params.currency, [params.currency]);
  const monthFilter = useMemo(() => Array.isArray(params.month) ? params.month[0] : params.month, [params.month]);

  const [transactions, setTransactions] = useState<TxRow[]>([]);
  const [wallets, setWallets] = useState<any[]>([]);
  const [categoryMap, setCategoryMap] = useState<Record<string, string>>({});
  const [refreshing, setRefreshing] = useState(false);
  const [walletPickerVisible, setWalletPickerVisible] = useState(false);
  const [walletPickerWallets, setWalletPickerWallets] = useState<WalletItem[]>([]);
  const [walletPickerFlow, setWalletPickerFlow] = useState<WalletPickerFlow | null>(null);
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
        getCategoryNameRows(),
      ]);

      setTransactions((txData as TxRow[]).filter((tx) => (!categoryId || tx.categoryId === categoryId) && (!currencyFilter || tx.currency === currencyFilter) && (!monthFilter || tx.transactionDate.slice(0, 7) === monthFilter)));
      setWallets(walletData);
      setCategoryMap(
        Object.fromEntries(categoryRows.map((row) => [row.id, row.name ?? 'Uncategorized'])),
      );
    } catch (error) {
      console.error('Error loading transactions:', error);
    }
  }, [user, walletId, categoryId, currencyFilter, monthFilter]);

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

  const closeWalletPicker = useCallback(() => {
    setWalletPickerVisible(false);
    setWalletPickerFlow(null);
  }, []);

  const mapWalletOptions = useCallback(
    (walletOptions: Awaited<ReturnType<typeof fetchWallets>>): WalletItem[] =>
      walletOptions.map((w) => ({
        id: w.id,
        name: w.name ?? '',
        currency: w.currency ?? 'USD',
      })),
    [],
  );

  const approveTransfer = useCallback(
    async (
      proposal: ProposedTransaction,
      walletId: string,
      transferToWalletId: string,
      walletsById: Map<string, WalletItem>,
    ) => {
      if (walletId === transferToWalletId) {
        Alert.alert('Cannot approve', 'Source and destination wallets must differ.');
        return;
      }
      const fromWallet = walletsById.get(walletId);
      const toWallet = walletsById.get(transferToWalletId);
      if (fromWallet && toWallet) {
        if (fromWallet.currency.toUpperCase() !== toWallet.currency.toUpperCase()) {
          Alert.alert(
            'Cannot approve',
            'Transfers require both wallets to use the same currency.',
          );
          return;
        }
      }
      try {
        await approve(proposal, { walletId, transferToWalletId });
        Alert.alert('Approved', 'Transaction has been added to your records.');
      } catch (e) {
        Alert.alert('Error', e instanceof Error ? e.message : 'Failed to approve');
      }
    },
    [approve],
  );

  const handleApprove = useCallback(
    async (proposal: ProposedTransaction) => {
      const isTransfer = proposal.type === 'transfer';

      if (isTransfer) {
        if (proposal.walletId && proposal.transferToWalletId) {
          const walletOptions = await fetchWallets();
          const walletsById = new Map(mapWalletOptions(walletOptions).map((w) => [w.id, w]));
          await approveTransfer(
            proposal,
            proposal.walletId,
            proposal.transferToWalletId,
            walletsById,
          );
          return;
        }

        const walletOptions = await fetchWallets();
        const options = mapWalletOptions(walletOptions);

        if (proposal.walletId && !proposal.transferToWalletId) {
          setWalletPickerWallets(options.filter((w) => w.id !== proposal.walletId));
          setWalletPickerFlow({
            proposal,
            step: 'transfer-destination',
            sourceWalletId: proposal.walletId,
            sourceCurrency:
              options.find((w) => w.id === proposal.walletId)?.currency.toUpperCase() ?? 'USD',
          });
        } else {
          setWalletPickerWallets(options);
          setWalletPickerFlow({ proposal, step: 'transfer-source' });
        }
        setWalletPickerVisible(true);
        return;
      }

      const walletOptions = await fetchWallets();
      const options = mapWalletOptions(walletOptions);
      const initialWalletId = resolveInitialWalletId(
        proposal,
        options,
        getDefaultWalletId(),
      );
      if (initialWalletId) {
        try {
          await approve(proposal, { walletId: initialWalletId });
          Alert.alert('Approved', 'Transaction has been added to your records.');
        } catch (e) {
          Alert.alert('Error', e instanceof Error ? e.message : 'Failed to approve');
        }
        return;
      }

      setWalletPickerWallets(options);
      setWalletPickerFlow({ proposal, step: 'single' });
      setWalletPickerVisible(true);
    },
    [approve, approveTransfer, fetchWallets, mapWalletOptions],
  );

  const handleWalletSelected = useCallback(
    async (selectedWalletId: string) => {
      if (!walletPickerFlow) return;

      const { proposal } = walletPickerFlow;

      if (walletPickerFlow.step === 'single') {
        closeWalletPicker();
        try {
          await approve(proposal, { walletId: selectedWalletId });
          Alert.alert('Approved', 'Transaction has been added to your records.');
        } catch (e) {
          Alert.alert('Error', e instanceof Error ? e.message : 'Failed to approve');
        }
        return;
      }

      if (walletPickerFlow.step === 'transfer-source') {
        const destId = proposal.transferToWalletId;
        if (destId) {
          const walletsById = new Map(walletPickerWallets.map((w) => [w.id, w]));
          closeWalletPicker();
          await approveTransfer(proposal, selectedWalletId, destId, walletsById);
          return;
        }

        const selected = walletPickerWallets.find((w) => w.id === selectedWalletId);
        const destinationOptions = walletPickerWallets.filter((w) => w.id !== selectedWalletId);
        if (destinationOptions.length === 0) {
          Alert.alert('Cannot approve', 'Add another wallet to complete this transfer.');
          return;
        }

        setWalletPickerWallets(destinationOptions);
        setWalletPickerFlow({
          proposal,
          step: 'transfer-destination',
          sourceWalletId: selectedWalletId,
          sourceCurrency: selected?.currency.toUpperCase() ?? 'USD',
        });
        return;
      }

      const { sourceWalletId, sourceCurrency } = walletPickerFlow;
      const destination = walletPickerWallets.find((w) => w.id === selectedWalletId);
      if (selectedWalletId === sourceWalletId) {
        Alert.alert('Cannot approve', 'Source and destination wallets must differ.');
        return;
      }
      if (destination && destination.currency.toUpperCase() !== sourceCurrency) {
        Alert.alert(
          'Cannot approve',
          'Transfers require both wallets to use the same currency.',
        );
        return;
      }

      closeWalletPicker();
      const walletsById = new Map(
        [...walletPickerWallets, { id: sourceWalletId, name: '', currency: sourceCurrency }].map(
          (w) => [w.id, w],
        ),
      );
      await approveTransfer(proposal, sourceWalletId, selectedWalletId, walletsById);
    },
    [walletPickerFlow, walletPickerWallets, approve, approveTransfer, closeWalletPicker],
  );

  const handleReject = useCallback(
    (id: string) => {
      const debtActivityId = transactions.find((transaction) => transaction.id === id)?.debtActivityId;
      if (debtActivityId) { router.push('/debts' as any); return; }
      Alert.alert('Reject proposal', 'This will discard the AI-proposed transaction.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Reject', style: 'destructive', onPress: () => reject(id) },
      ]);
    },
    [reject],
  );

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
                await loadData();
                await reloadProposals();
              } catch (e) {
                Alert.alert('Error', e instanceof Error ? e.message : 'Failed to delete');
              }
            },
          },
        ],
      );
    },
    [loadData, reloadProposals, transactions],
  );

  const currency = selectedWallet?.currency ?? 'USD';

  return (
    <View className="flex-1 bg-background">
      <ScrollView
        className="flex-1"
        contentContainerClassName="grow"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}>
        <View className="px-4 pt-2 pb-4">
          {selectedWallet ? (
            <GradientCard cardStyle={getWalletCardStyle(selectedWallet.cardStyleId)} className="rounded-3xl p-4">
              <View className="flex-row items-start justify-between">
                <View className="flex-row items-center flex-1">
                  <View className="w-12 h-12 rounded-2xl items-center justify-center bg-white/20">
                    <Text className="text-lg font-bold text-white">{selectedWallet.icon ?? 'W'}</Text>
                  </View>
                  <View className="ml-3 flex-1">
                    <Text className="text-xs font-semibold uppercase tracking-wide text-white/80">
                      {selectedWallet.type ?? 'Wallet'}
                    </Text>
                    <Text className="text-xl font-bold text-white">{selectedWallet.name}</Text>
                    <Text className="text-sm text-white/75">{selectedWallet.currency ?? 'USD'}</Text>
                  </View>
                </View>
              </View>
              <View className="mt-4 border-t border-white/20 pt-4">
                <Text className="text-xs font-medium text-white/75">Current balance</Text>
                <Text className="text-2xl font-bold text-white mt-0.5">
                  {formatMoney(
                    Number(selectedWallet.currentBalance ?? selectedWallet.initialBalance ?? 0),
                    currency,
                  )}
                </Text>
              </View>
              <View className="mt-4 flex-row gap-3">
                <View className="flex-1 rounded-xl bg-white/15 px-3 py-2">
                  <Text className="text-[11px] font-medium uppercase text-white/70">Total Income</Text>
                  <Text className="text-base font-semibold text-white">
                    {formatMoney(listStats.income, currency)}
                  </Text>
                </View>
                <View className="flex-1 rounded-xl bg-white/15 px-3 py-2">
                  <Text className="text-[11px] font-medium uppercase text-white/70">Total Expenses</Text>
                  <Text className="text-base font-semibold text-white">
                    {formatMoney(listStats.expense, currency)}
                  </Text>
                </View>
              </View>
            </GradientCard>
          ) : (
            <View className="rounded-2xl border border-border bg-card p-4">
              <Text className="text-sm font-medium text-muted">All wallets</Text>
              <Text className="mt-1 text-lg font-bold text-foreground">
                {listStats.count} transaction{listStats.count === 1 ? '' : 's'} loaded
              </Text>
              <Text className="mt-1 text-xs text-muted">
                Open a wallet from Wallets to filter by account and see balance.
              </Text>
            </View>
          )}
        </View>

        <View className="mt-2 px-4 pb-6">
          {proposals.length > 0 ? (
            <View className="mb-4">
              <View className="flex-row items-center justify-between mb-2">
                <Text className="text-xs font-bold uppercase tracking-wider text-muted">
                  Pending Proposals
                </Text>
                {proposalsLoading ? <ActivityIndicator size="small" color="#6b7280" /> : null}
              </View>
              {proposals.map((p) => (
                <ProposalCard
                  key={p.id}
                  item={p}
                  wallets={mapWalletOptions(wallets)}
                  onApprove={handleApprove}
                  onReject={handleReject}
                />
              ))}
            </View>
          ) : null}

          <View className="flex-row justify-between items-center mb-2">
            <View className="flex-1 mr-2">
              <Text className="text-sm font-semibold text-foreground">
                Recent transactions
              </Text>
              {/* <Text className="text-sm font-semibold text-foreground">
                  {walletId ? `${selectedWallet?.name ?? 'Wallet'}` : 'All transactions'}
                </Text> */}
              <Text className="mt-0.5 text-xs text-muted">
                {walletId ? 'Recorded in this wallet' : 'Across every wallet'}
              </Text>
            </View>
            <Link
              href={(walletId ? `/transaction/new?walletId=${walletId}` : '/transaction/new') as any}
              asChild>
              <TouchableOpacity className="rounded-lg bg-primary px-4 py-2">
                <Text className="text-white font-semibold">+ Add</Text>
              </TouchableOpacity>
            </Link>
          </View>

          {transactions.length === 0 ? (
            <View className="mb-2 mt-1 rounded-2xl border border-dashed border-border bg-card p-4">
              <Text className="text-center text-sm text-muted">
                No transactions yet. Tap + Add to create one.
              </Text>
            </View>
          ) : (
            transactions.map((item) => {
              const isIncome = item.type === 'income';
              const isTransfer = item.type === 'transfer';
              const categoryLabel = item.categoryId ? categoryMap[item.categoryId] : null;
              const title =
                isTransfer
                  ? formatTransferLabel(
                    {
                      wallet_id: item.walletId,
                      transfer_to_wallet_id: item.transferToWalletId,
                      type: item.type,
                    },
                    Object.fromEntries(
                      Object.entries(walletMap as Record<string, any>).map(([id, w]) => [id, w?.name ?? 'Wallet']),
                    ),
                    selectedWallet?.id,
                  )
                  : item.merchant || item.description || item.type;
              const amountClass = isTransfer ? 'text-transfer' : isIncome ? 'text-income' : 'text-expense';
              return (
                <Pressable
                  key={item.id}
                  accessibilityRole="button"
                  accessibilityHint="Opens transaction details"
                  onPress={() => { router.push(item.debtActivityId ? '/debts' as any : { pathname: '/transaction/[id]', params: { id: item.id } }); }}
                  style={({ pressed }) => (pressed ? { opacity: 0.92 } : undefined)}
                  className="mb-2 rounded-2xl border border-border bg-card p-3">
                  <View className="flex-row items-start justify-between gap-2">
                    <View className="flex-1 min-w-0 pr-1">
                      <Text className="text-base font-semibold text-foreground" numberOfLines={2}>
                        {title}
                      </Text>
                      {!isTransfer && item.description && item.merchant ? (
                        <Text className="text-sm text-muted mt-0.5" numberOfLines={2}>
                          {item.description}
                        </Text>
                      ) : null}
                      {isTransfer && item.description ? (
                        <Text className="text-sm text-muted mt-0.5" numberOfLines={2}>
                          {item.description}
                        </Text>
                      ) : null}
                      <View className="flex-row flex-wrap items-center gap-x-2 gap-y-1 mt-2">
                        <Text className="text-xs text-muted">
                          {new Date(item.transactionDate).toLocaleString(undefined, {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                          })}
                        </Text>
                        {isTransfer ? (
                          <View className="rounded-full bg-transfer/15 px-2 py-0.5">
                            <Text className="text-[11px] font-medium text-transfer">
                              Transfer
                            </Text>
                          </View>
                        ) : item.debtActivityId ? (
                          <View className="rounded-full bg-primary/15 px-2 py-0.5"><Text className="text-[11px] font-medium text-primary">Debt</Text></View>
                        ) : categoryLabel ? (
                          <View className="rounded-full bg-background-muted px-2 py-0.5">
                            <Text className="text-[11px] font-medium text-foreground">
                              {categoryLabel}
                            </Text>
                          </View>
                        ) : null}
                        {!isTransfer ? (
                          <Text className="text-xs text-muted">
                            {walletMap[item.walletId]?.name ?? 'Wallet'}
                          </Text>
                        ) : null}
                      </View>
                      {item.notes ? (
                        <Text className="text-xs text-muted mt-1 italic" numberOfLines={2}>
                          {item.notes}
                        </Text>
                      ) : null}
                    </View>
                    <View className="items-end shrink-0">
                      <View className="mb-1 flex-row items-center gap-0.5">
                        <Pressable
                          accessibilityLabel="Delete transaction"
                          hitSlop={8}
                          onPress={() => handleDeleteTransaction(item.id)}
                          className="rounded p-1 active:opacity-70">
                          <MaterialIcons name="delete-outline" size={18} color={tokens.danger} />
                        </Pressable>
                      </View>
                      <Text className={`text-lg font-bold ${amountClass}`}>
                        {isTransfer ? '' : isIncome ? '+' : '−'}
                        {item.amount.toFixed(2)}
                      </Text>
                      <Text className="mt-0.5 text-xs text-muted">
                        {walletMap[item.walletId]?.currency ?? 'USD'}
                      </Text>
                    </View>
                  </View>
                </Pressable>
              );
            })
          )}
        </View>
      </ScrollView>
      <WalletPickerModal
        visible={walletPickerVisible}
        title={walletPickerTitle(walletPickerFlow)}
        wallets={walletPickerWallets}
        onSelect={handleWalletSelected}
        onCancel={closeWalletPicker}
      />
    </View>
  );
}
