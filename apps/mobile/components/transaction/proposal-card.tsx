import { Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import {
  formatMinorAmount,
  type ProposedTransaction,
} from '@repo/types';

import { IconAction } from '@/components/ui/icon-action';
import { PrimaryButton } from '@/components/ui/primary-button';
import { Surface } from '@/components/ui/surface';
import { getDefaultWalletId } from '@/lib/wallets/default-wallet';
import { displayCurrencyForProposal } from '@/lib/wallets/proposal-wallet';

type WalletItem = { id: string; name: string; currency: string };

type ProposalCardProps = {
  item: ProposedTransaction;
  wallets: WalletItem[];
  onApprove: (p: ProposedTransaction) => void;
  onReject: (id: string) => void;
};

/**
 * Compact, non-interruptive review entry. Full proposal decisions stay in the
 * receipt-like review route; this card makes its source and pending state clear.
 */
export function ProposalCard({
  item,
  wallets,
  onApprove,
  onReject,
}: ProposalCardProps) {
  const isExpense = item.type === 'expense' || !item.type;
  const isTransfer = item.type === 'transfer';
  const displayCurrency = displayCurrencyForProposal(
    item,
    wallets,
    getDefaultWalletId(),
  );
  const amountClass = isTransfer
    ? 'text-transfer'
    : isExpense
      ? 'text-expense'
      : 'text-income';

  return (
    <Surface className="mb-3 p-4">
      <View className="mb-3 flex-row items-start justify-between gap-3">
        <View className="min-w-0 flex-1">
          <Text className="text-xs font-bold uppercase tracking-wide text-primary">
            Review before adding
          </Text>
          <Text
            className="mt-1 text-sm font-semibold text-foreground"
            numberOfLines={1}
          >
            {item.sourceApp || 'Moni found this'}
          </Text>
        </View>
        <IconAction
          accessibilityLabel="Edit proposal details"
          icon="edit"
          onPress={() =>
            router.push({
              pathname: '/proposal/[id]',
              params: { id: item.id },
            } as any)
          }
          size={18}
        />
      </View>
      <Text
        className={['text-[28px]', 'font-bold', amountClass].join(
          ' ',
        )}
      >
        {isTransfer ? '' : isExpense ? '−' : '+'}
        {item.amountMinor != null
          ? formatMinorAmount(item.amountMinor, displayCurrency)
          : '—'}
      </Text>
      <Text
        className="mt-1 text-base font-semibold text-foreground"
        numberOfLines={1}
      >
        {item.merchant ||
          item.description ||
          item.type ||
          'Transaction'}
      </Text>
      <View className="mt-4 flex-row gap-2">
        <PrimaryButton
          className="min-h-11 flex-1 py-2"
          icon="check"
          label="Approve"
          onPress={() => onApprove(item)}
        />
        <TouchableOpacity
          className="min-h-11 flex-1 flex-row items-center justify-center rounded-2xl bg-surface-2 px-3 py-2"
          onPress={() => onReject(item.id)}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Decline proposal"
        >
          <Text className="text-sm font-bold text-foreground">
            Decline
          </Text>
        </TouchableOpacity>
      </View>
    </Surface>
  );
}
