import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import type { ProposedTransaction } from '@repo/types';
import {
  approveProposedTransaction,
  getProposedTransactions,
  rejectProposedTransaction,
} from '@/lib/supabase/proposed-transactions';
import { getWallets } from '@/lib/supabase/wallets';

export function useProposedTransactions() {
  const [proposals, setProposals] = useState<ProposedTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const pending = await getProposedTransactions();
      setProposals(pending);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load proposals');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const approve = useCallback(
    async (
      proposal: ProposedTransaction,
      wallets: { walletId: string; transferToWalletId?: string | null },
    ) => {
      await approveProposedTransaction(proposal, wallets);
      setProposals((prev) => prev.filter((p) => p.id !== proposal.id));
    },
    [],
  );

  const reject = useCallback(async (id: string) => {
    await rejectProposedTransaction(id);
    setProposals((prev) => prev.filter((p) => p.id !== id));
  }, []);

  /** Fetch wallets for the approval wallet-picker. */
  const fetchWallets = useCallback(() => getWallets(), []);

  return {
    proposals,
    isLoading,
    error,
    reload: load,
    approve,
    reject,
    fetchWallets,
  };
}
