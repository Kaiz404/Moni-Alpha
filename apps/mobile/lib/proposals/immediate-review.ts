import { useEffect, useState } from 'react';

export type ImmediateReviewCopy = {
  title: string;
  detail: string;
  icon: 'receipt' | 'chat' | 'voice';
};

export type ImmediateReviewState = {
  active: boolean;
  proposalId: string | null;
  copy: ImmediateReviewCopy | null;
  /** Set only after extraction produced a proposal that can be inspected. */
  readyAt: number | null;
  startedAt: number | null;
};

let state: ImmediateReviewState = {
  active: false,
  proposalId: null,
  copy: null,
  readyAt: null,
  startedAt: null,
};

const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((listener) => listener());
}

/** Start a transparent processing state for an explicitly user-initiated AI capture. */
export function beginImmediateProposalReview(proposalId: string, copy: ImmediateReviewCopy) {
  state = {
    active: true,
    proposalId,
    copy,
    readyAt: null,
    startedAt: Date.now(),
  };
  notify();
}

/** Mark the current user-initiated proposal as ready for the full review artifact. */
export function completeImmediateProposalReview(proposalId: string) {
  if (!state.active || state.proposalId !== proposalId) return;
  state = { ...state, readyAt: Date.now() };
  notify();
}

/** Clear a failed, cancelled, or completed immediate-review presentation. */
export function clearImmediateProposalReview(proposalId?: string) {
  if (proposalId && state.proposalId !== proposalId) return;
  if (!state.active) return;
  state = {
    active: false,
    proposalId: null,
    copy: null,
    readyAt: null,
    startedAt: null,
  };
  notify();
}

/** Non-reactive snapshot for rare imperative callers. UI should use the hook. */
export function getImmediateProposalReview(): ImmediateReviewState {
  return state;
}

export function useImmediateProposalReview() {
  const [, bump] = useState(0);

  useEffect(() => {
    const listener = () => bump((value) => value + 1);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  return state;
}
