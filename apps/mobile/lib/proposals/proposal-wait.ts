import { DeviceEventEmitter } from 'react-native';

import { getAll } from '@/lib/ai/processing-queue';
import { PROPOSED_TRANSACTIONS_CHANGED } from '@/lib/proposals/proposed-transactions-events';
import { getProposedTransactions } from '@/lib/supabase/proposed-transactions';

export type ProposalWaitResult = 'ready' | 'error' | 'timeout';

/**
 * Wait for an already-enqueued, user-initiated capture to become reviewable.
 * This watches both the local queue and the observable proposal store, so it
 * works whether the foreground service or the fallback processor is active.
 */
export function waitForProposal(
  proposalId: string,
  timeoutMs = 120_000,
): Promise<ProposalWaitResult> {
  return new Promise((resolve) => {
    const deadline = Date.now() + timeoutMs;
    let settled = false;

    const finish = (result: ProposalWaitResult) => {
      if (settled) return;
      settled = true;
      subscription.remove();
      clearInterval(interval);
      resolve(result);
    };

    const check = async () => {
      try {
        const proposals = await getProposedTransactions();
        if (proposals.some((proposal) => proposal.id === proposalId)) {
          finish('ready');
          return;
        }

        const item = getAll().find((entry) => entry.id === proposalId);
        if (item?.status === 'error') {
          finish('error');
          return;
        }

        if (Date.now() > deadline) finish('timeout');
      } catch {
        if (Date.now() > deadline) finish('timeout');
      }
    };

    const subscription = DeviceEventEmitter.addListener(
      PROPOSED_TRANSACTIONS_CHANGED,
      () => void check(),
    );
    const interval = setInterval(() => void check(), 400);

    void check();
  });
}
