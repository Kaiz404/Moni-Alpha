import { Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import type { ProposedTransaction } from '@repo/types';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { getDefaultWalletId } from '@/lib/wallets/default-wallet';
import { displayCurrencyForProposal } from '@/lib/wallets/proposal-wallet';

type WalletItem = { id: string; name: string; currency: string };

type ProposalCardProps = {
  item: ProposedTransaction;
  wallets: WalletItem[];
  onApprove: (p: ProposedTransaction) => void;
  onReject: (id: string) => void;
};

export function ProposalCard({ item, wallets, onApprove, onReject }: ProposalCardProps) {
  const isExpense = item.type === 'expense' || !item.type;
  const isTransfer = item.type === 'transfer';
  const displayCurrency = displayCurrencyForProposal(item, wallets, getDefaultWalletId());
  const amountClass = isTransfer ? 'text-transfer' : isExpense ? 'text-expense' : 'text-income';

  return (
    <View className="mb-2 rounded-2xl border border-border bg-card p-4">
      <View className="mb-1 flex-row items-center justify-between">
        <Text className="text-xs font-semibold text-primary">
          {item.sourceApp || 'AI proposal'}
        </Text>
        <TouchableOpacity
          onPress={() =>
            router.push({ pathname: '/proposal/[id]', params: { id: item.id } } as any)
          }
          hitSlop={6}>
          <Text className="text-xs font-semibold text-muted">Edit details</Text>
        </TouchableOpacity>
      </View>
      <Text className={`text-xl font-bold ${amountClass}`}>
        {isTransfer ? '' : isExpense ? '−' : '+'}
        {displayCurrency} {item.amount?.toFixed(2) ?? '—'}
      </Text>
      <Text className="mt-1 text-sm text-foreground" numberOfLines={1}>
        {item.merchant || item.description || item.type || 'Transaction'}
      </Text>
      <View className="mt-3 flex-row gap-2">
        <TouchableOpacity
          className="flex-1 flex-row items-center justify-center gap-1 rounded-xl bg-primary py-2.5"
          onPress={() => onApprove(item)}>
          <IconSymbol name="check" size={14} color="#ffffff" />
          <Text className="text-sm font-semibold text-primary-foreground">Approve</Text>
        </TouchableOpacity>
        <TouchableOpacity
          className="flex-1 flex-row items-center justify-center gap-1 rounded-xl bg-background-muted py-2.5"
          onPress={() => onReject(item.id)}>
          <IconSymbol name="close" size={14} color="#6b7280" />
          <Text className="text-sm font-semibold text-foreground">Reject</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
