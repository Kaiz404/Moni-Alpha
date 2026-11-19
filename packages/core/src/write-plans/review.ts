import {
  transactionAlertSchema,
  type ProposedTransaction,
  type ProposedTransactionSourceType,
  type TransactionAlert,
  type TransactionSource,
} from '@repo/types';

import { isFiled } from '../ledger';
import { merchantKey } from '../read-model/merchants';
import type { FinanceTransaction } from '../read-model/types';
import { checkTransfer, planTransaction } from './transactions';
import { planned, refused, type LedgerView, type PlanContext, type Planned, type StoredPatch } from './types';

/** Filed this many times, a merchant is "Usual for you"; fewer, "Seen before". Moni's routine streak. */
export const USUAL_AFTER = 3;

export type Familiarity = 'usual' | 'seen' | null;

const SOURCE: Record<ProposedTransactionSourceType, TransactionSource> = {
  notification: 'notification',
  text: 'moni',
  image: 'camera',
};

/** How many of the user's filed rows share this capture's merchant, type and currency. */
export function timesFiled(
  proposal: Pick<ProposedTransaction, 'merchant' | 'type' | 'currency'>,
  transactions: readonly FinanceTransaction[],
): number {
  const key = merchantKey(proposal.merchant);
  if (!key || (proposal.type !== 'expense' && proposal.type !== 'income')) return 0;
  return transactions.filter(
    (transaction) =>
      transaction.type === proposal.type &&
      transaction.currency === proposal.currency &&
      isFiled(transaction) &&
      merchantKey(transaction.merchant) === key,
  ).length;
}

/** The Review card's familiarity pill: "Usual for you" or "Seen before". */
export function familiarity(times: number): Familiarity {
  return times >= USUAL_AFTER ? 'usual' : times >= 1 ? 'seen' : null;
}

/**
 * The captures "Approve all usual" takes: a usual merchant with a wallet and a category picked, so
 * Approve needs nothing more. A transfer always waits for a look.
 */
export function usualCaptures<P extends ProposedTransaction>(
  proposals: readonly P[],
  transactions: readonly FinanceTransaction[],
): P[] {
  return proposals.filter(
    (proposal) =>
      proposal.walletId !== null &&
      proposal.categoryId !== null &&
      proposal.amountMinor !== null &&
      proposal.type !== 'transfer' &&
      familiarity(timesFiled(proposal, transactions)) === 'usual',
  );
}

/** Which delivery of which alert: a redelivered notification repeats all four parts. */
function alertKey(proposal: ProposedTransaction): string {
  return JSON.stringify([
    proposal.sourceApp ?? '',
    proposal.notificationTitle ?? '',
    proposal.notificationBody ?? '',
    proposal.notificationReceivedAt ? Date.parse(proposal.notificationReceivedAt) : null,
  ]);
}

/** The bank alert a notification capture keeps on the ledger row it becomes. */
export function captureAlert(proposal: ProposedTransaction): TransactionAlert | undefined {
  if (proposal.sourceType !== 'notification') return undefined;
  const parsed = transactionAlertSchema.safeParse({
    text: proposal.notificationBody?.trim().slice(0, 1000),
    amountMinor: proposal.amountMinor,
    currency: proposal.currency,
    key: alertKey(proposal),
    captureId: proposal.id,
  });
  return parsed.success ? parsed.data : undefined;
}

/** The wallet picked for a capture before Approve ("Needs a wallet"). */
export function planCaptureWallet(
  proposalId: string,
  walletId: string,
  view: Pick<LedgerView, 'walletsById'>,
  ctx: Pick<PlanContext, 'now'>,
): Planned<null> {
  if (!view.walletsById[walletId]) return refused('Wallet not found');
  return planned({ patch: [{ table: 'proposed_transactions', id: proposalId, patch: { wallet_id: walletId, updated_at: ctx.now } }] }, null);
}

/**
 * Approve: the ledger row the capture becomes, and the capture closed as approved. Without the
 * review_history migration the capture has no reviewed_at column, so it is soft-deleted instead.
 * The phone's device-side effects (capture log status, receipt upload, place snapshot) stay on the phone.
 */
export function planApprove(
  proposal: ProposedTransaction,
  view: Pick<LedgerView, 'walletsById'>,
  ctx: PlanContext & { reviewHistory: boolean },
): Planned<{ transactionId: string }> {
  if (proposal.status === 'approved' || proposal.status === 'rejected') return refused('This capture was already reviewed.');
  if (!proposal.walletId) return { kind: 'needsInput', field: 'wallet' };
  if (!proposal.type) return refused('Pick a type first.');
  if (!proposal.amountMinor || proposal.amountMinor <= 0) return refused('Enter an amount above zero.');
  if (proposal.type === 'transfer') {
    const problem = checkTransfer(view, proposal.walletId, proposal.transferToWalletId);
    if (problem) return problem;
  }
  const alert = captureAlert(proposal);
  const row = planTransaction(
    {
      walletId: proposal.walletId,
      amountMinor: proposal.amountMinor,
      type: proposal.type,
      transferToWalletId: proposal.type === 'transfer' ? proposal.transferToWalletId : null,
      categoryId: proposal.type === 'transfer' ? null : proposal.categoryId,
      description: proposal.description,
      merchant: proposal.merchant,
      transactionDate: proposal.transactionDate ?? ctx.now,
      metadata: { ...(alert ? { alert } : {}), ...(proposal.pairing ? { pairing: proposal.pairing } : {}) },
    },
    SOURCE[proposal.sourceType],
    view,
    ctx,
  );
  if (row.kind !== 'writes') return row;
  const transactionId = row.result.id;
  const close: StoredPatch<'proposed_transactions'> = ctx.reviewHistory
    ? { status: 'approved', reviewed_at: ctx.now, transaction_id: transactionId, updated_at: ctx.now }
    : { status: 'approved', updated_at: ctx.now };
  return planned(
    {
      insert: row.writes.insert,
      patch: [{ table: 'proposed_transactions', id: proposal.id, patch: close }],
      softDelete: ctx.reviewHistory ? [] : [{ table: 'proposed_transactions', id: proposal.id, at: ctx.now }],
    },
    { transactionId },
  );
}
