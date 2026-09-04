import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
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
  type CategoryOption,
  type EditedFields,
  type WalletOption,
} from '@/components/proposal/proposal-form';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import {
  isoToLocalDateInput,
  localDateInputToIso,
} from '@/lib/dates/local-date-input';
import { formatMinorAmount } from '@/lib/finance/money';
import type { DuplicateMatch } from '@/lib/ai/duplicates';
import {
  approveProposedTransaction,
  findProposalDuplicate,
  getProposedTransactions,
  rejectProposedTransaction,
  resolveDuplicate,
} from '@/lib/supabase/proposed-transactions';
import { getWallets } from '@/lib/supabase/wallets';
import { getCategories } from '@/lib/supabase/categories';

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
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isActioning, setIsActioning] = useState(false);
  const [duplicate, setDuplicate] = useState<DuplicateMatch | null>(
    null,
  );

  const loadData = useCallback(async () => {
    if (!proposalId) {
      setLoadError('Proposal not found.');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setLoadError(null);
    try {
      const [pending, ws, categoryRows] = await Promise.all([
        getProposedTransactions(),
        getWallets(),
        getCategories(),
      ]);
      const found = pending.find((p) => p.id === proposalId) ?? null;
      setProposal(found);
      setDuplicate(
        found ? await findProposalDuplicate(found.id, found) : null,
      );
      setWallets(
        ws.map((w) => ({
          id: w.id,
          name: w.name ?? 'Wallet',
          type: w.type ?? 'other',
          currency: w.currency ?? 'MYR',
        })),
      );
      setCategories(
        categoryRows.map((category) => ({
          id: category.id,
          name: category.name ?? 'Category',
          icon: category.icon,
          type: category.type,
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
          categoryId:
            effectiveType === 'transfer' ? null : edited.categoryId,
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

  const handleMerge = useCallback(async () => {
    if (!proposal || !duplicate || isActioning) return;
    setIsActioning(true);
    try {
      await resolveDuplicate(proposal, duplicate);
      router.back();
    } catch (e) {
      const message =
        e instanceof Error ? e.message : 'Failed to merge';
      console.error('[ProposalDetail] merge error:', e);
      Alert.alert('Error', message);
    } finally {
      setIsActioning(false);
    }
  }, [proposal, duplicate, isActioning]);

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
          {duplicate ? (
            <View className="mb-4 gap-3 rounded-2xl bg-card p-4">
              <Text className="text-sm text-foreground">
                {duplicate.kind === 'same_purchase'
                  ? `You may already have this: ${duplicate.target.merchant ?? proposal.description ?? 'Transaction'} ${formatMinorAmount(duplicate.target.amountMinor ?? 0, duplicate.target.currency)} on ${isoToLocalDateInput(duplicate.target.at)}.`
                  : 'Matches money arriving in another wallet. Likely a transfer between your wallets.'}
              </Text>
              <Pressable
                onPress={handleMerge}
                disabled={isActioning}
                className="items-center rounded-2xl bg-surface-2 py-3"
                accessibilityRole="button"
              >
                <Text className="text-sm font-semibold text-foreground">
                  {duplicate.kind === 'same_purchase'
                    ? 'Same purchase · merge'
                    : 'Combine into transfer'}
                </Text>
              </Pressable>
            </View>
          ) : null}
          <ProposalForm
            proposal={proposal}
            wallets={wallets}
            categories={categories}
            isActioning={isActioning}
            onApprove={handleApprove}
            onReject={handleReject}
          />
        </ScrollView>
      )}
    </ScreenShell>
  );
}
