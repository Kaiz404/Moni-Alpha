import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import type { ProposedTransaction } from '@repo/types';

import { BrandHeader } from '@/components/ui/brand-header';
import { ScreenShell } from '@/components/ui/screen-shell';
import {
  ProposalForm,
  type EditedFields,
  type WalletOption,
} from '@/components/proposal/proposal-form';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { localDateInputToIso } from '@/lib/dates/local-date-input';
import {
  approveProposedTransaction,
  getProposedTransactions,
  rejectProposedTransaction,
} from '@/lib/supabase/proposed-transactions';
import { getWallets } from '@/lib/supabase/wallets';

export default function ProposalDetailScreen() {
  const tokens = useThemeTokens();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const proposalId = useMemo(() => {
    const x = params.id;
    return Array.isArray(x) ? x[0] : x;
  }, [params.id]);

  const [proposal, setProposal] =
    useState<ProposedTransaction | null>(null);
  const [wallets, setWallets] = useState<WalletOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isActioning, setIsActioning] = useState(false);

  const loadData = useCallback(async () => {
    if (!proposalId) {
      setLoadError('Proposal not found.');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setLoadError(null);
    try {
      const [pending, ws] = await Promise.all([
        getProposedTransactions(),
        getWallets(),
      ]);
      const found = pending.find((p) => p.id === proposalId) ?? null;
      setProposal(found);
      setWallets(
        ws.map((w) => ({
          id: w.id,
          name: w.name ?? 'Wallet',
          type: w.type ?? 'other',
          currency: w.currency ?? 'MYR',
        })),
      );
      if (!found)
        setLoadError('Proposal not found or already reviewed.');
    } catch (e) {
      setLoadError(
        e instanceof Error ? e.message : 'Failed to load proposal.',
      );
    } finally {
      setIsLoading(false);
    }
  }, [proposalId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleApprove = useCallback(
    async (edited: EditedFields) => {
      if (!proposal || isActioning) return;

      const effectiveType = edited.type ?? proposal.type ?? 'expense';
      const walletId = edited.walletId ?? proposal.walletId;
      const transferToWalletId =
        edited.transferToWalletId ?? proposal.transferToWalletId;

      if (!walletId) {
        Alert.alert('Cannot approve', 'Select a source wallet.');
        return;
      }

      if (effectiveType === 'transfer') {
        if (!transferToWalletId) {
          Alert.alert(
            'Cannot approve',
            'Select a destination wallet for this transfer.',
          );
          return;
        }
        if (walletId === transferToWalletId) {
          Alert.alert(
            'Cannot approve',
            'Source and destination wallets must differ.',
          );
          return;
        }
        const fromWallet = wallets.find((w) => w.id === walletId);
        const toWallet = wallets.find(
          (w) => w.id === transferToWalletId,
        );
        if (
          fromWallet &&
          toWallet &&
          fromWallet.currency.toUpperCase() !==
            toWallet.currency.toUpperCase()
        ) {
          Alert.alert(
            'Cannot approve',
            'Transfers require both wallets to use the same currency.',
          );
          return;
        }
      }

      const transactionDateIso = edited.date
        ? localDateInputToIso(edited.date)
        : proposal.transactionDate;
      if (edited.date && !transactionDateIso) {
        Alert.alert(
          'Cannot approve',
          'Enter a valid date (YYYY-MM-DD).',
        );
        return;
      }

      setIsActioning(true);
      try {
        const updatedProposal: ProposedTransaction = {
          ...proposal,
          amountMinor: edited.amountMinor,
          type: effectiveType,
          merchant:
            effectiveType === 'transfer'
              ? null
              : edited.merchant || null,
          description: edited.description || null,
          transactionDate: transactionDateIso,
        };

        await approveProposedTransaction(updatedProposal, {
          walletId,
          transferToWalletId:
            effectiveType === 'transfer' ? transferToWalletId : null,
        });
        router.back();
      } catch (e) {
        const message =
          e instanceof Error ? e.message : 'Failed to approve';
        console.error('[ProposalDetail] approve error:', e);
        Alert.alert('Error', message);
      } finally {
        setIsActioning(false);
      }
    },
    [proposal, isActioning, wallets],
  );

  const handleReject = useCallback(async () => {
    if (!proposal || isActioning) return;
    setIsActioning(true);
    try {
      await rejectProposedTransaction(proposal.id);
      router.back();
    } catch (e) {
      const message =
        e instanceof Error ? e.message : 'Failed to reject';
      console.error('[ProposalDetail] reject error:', e);
      Alert.alert('Error', message);
    } finally {
      setIsActioning(false);
    }
  }, [proposal, isActioning]);

  return (
    <ScreenShell variant="canvas">
      <BrandHeader title="Review proposal" />
      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator
            size="large"
            color={tokens.primary}
          />
        </View>
      ) : loadError || !proposal ? (
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-center text-base text-muted">
            {loadError ?? 'Proposal not found.'}
          </Text>
        </View>
      ) : (
        <ScrollView
          className="flex-1"
          contentContainerClassName="px-4 pb-8 pt-4"
          showsVerticalScrollIndicator={false}
        >
          <ProposalForm
            proposal={proposal}
            wallets={wallets}
            isActioning={isActioning}
            onApprove={handleApprove}
            onReject={handleReject}
          />
        </ScrollView>
      )}
    </ScreenShell>
  );
}
