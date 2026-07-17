import { useCallback } from 'react';
import { useValue } from '@legendapp/state/react';
import type { ProposedTransaction } from '@repo/types';
import { useAuth } from '@/lib/auth/auth-context';
import { pendingProposals$, walletsForUser$ } from '@/lib/finance/selectors';
import {
  approveProposedTransaction,
  rejectProposedTransaction,
} from '@/lib/supabase/proposed-transactions';

export function useProposedTransactions() {
  const { user } = useAuth();
  const proposals = useValue(pendingProposals$(user?.id ?? null));
  const wallets = useValue(walletsForUser$(user?.id ?? null));

  const approve = useCallback(
    async (
      proposal: ProposedTransaction,
      wallets: { walletId: string; transferToWalletId?: string | null },
    ) => {
      await approveProposedTransaction(proposal, wallets);
    },
    [],
  );

  const reject = useCallback(async (id: string) => {
    await rejectProposedTransaction(id);
  }, []);

  /** Fetch wallets for the approval wallet-picker. */
  const fetchWallets = useCallback(async () => wallets, [wallets]);

  return {
    proposals,
    isLoading: false,
    error: null,
    reload: async () => {},
    approve,
    reject,
    fetchWallets,
  };
}
