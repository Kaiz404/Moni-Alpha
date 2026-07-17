import { useEffect, useState } from 'react';
import { DeviceEventEmitter } from 'react-native';

import { getAll } from '@/lib/ai/processing-queue';
import { PROPOSED_TRANSACTIONS_CHANGED } from '@/lib/proposals/proposed-transactions-events';
import { getProposedTransactions } from '@/lib/supabase/proposed-transactions';

type FabReceiptProcessingState = {
  active: boolean;
  proposalId: string | null;
};

let state: FabReceiptProcessingState = {
  active: false,
  proposalId: null,
};
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((listener) => listener());
}

export function startFabReceiptProcessing(proposalId: string) {
  state = { active: true, proposalId };
  notify();
}

export function stopFabReceiptProcessing() {
  if (!state.active) return;
  state = { active: false, proposalId: null };
  notify();
}

export function getFabReceiptProcessingProposalId(): string | null {
  return state.proposalId;
}

export function isFabReceiptProcessingActive(): boolean {
  return state.active;
}

export function useFabReceiptProcessing() {
  const [, bump] = useState(0);
  useEffect(() => {
    const listener = () => bump((n) => n + 1);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);
  return state;
}

export type ReceiptProposalWaitResult = 'ready' | 'error' | 'timeout';

/** Resolves when the queued receipt becomes a reviewable proposal or the queue item errors out. */
export function waitForReceiptProposal(
  proposalId: string,
  timeoutMs = 120_000,
): Promise<ReceiptProposalWaitResult> {
  return new Promise((resolve) => {
    const deadline = Date.now() + timeoutMs;
    let settled = false;

    const finish = (result: ReceiptProposalWaitResult) => {
      if (settled) return;
      settled = true;
      sub.remove();
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

        if (Date.now() > deadline) {
          finish('timeout');
        }
      } catch {
        if (Date.now() > deadline) finish('timeout');
      }
    };

    const sub = DeviceEventEmitter.addListener(PROPOSED_TRANSACTIONS_CHANGED, () => {
      void check();
    });
    const interval = setInterval(() => {
      void check();
    }, 400);

    void check();
  });
}
