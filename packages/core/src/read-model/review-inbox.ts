import type { MerchantAlias, ProposedTransaction } from '@repo/types';

import type { Calendar } from '../calendar';
import { isFiled } from '../ledger';
import { similarRule, USUAL_AFTER, type ReviewEdits } from '../write-plans/review';
import { merchantKey, merchantName } from './merchants';
import { transactionRow, type RowLookups, type TransactionRow } from './transaction-row';
import type { FinanceTransaction } from './types';

/** Recently reviewed reaches back this many days. */
export const REVIEW_HISTORY_DAYS = 30;
const DAY_MS = 86_400_000;

export type ReviewStatus = { tone: 'near' | 'review' | 'onTrack'; label: string };

/** The pill on a capture's source row. A warning always outranks how familiar the merchant is. */
export function reviewStatus(facts: {
  hasWallet: boolean;
  paired: boolean;
  maybeDuplicate: boolean;
  timesFiled: number;
}): ReviewStatus | null {
  if (!facts.hasWallet) return { tone: 'near', label: 'Needs a wallet' };
  if (facts.paired) return { tone: 'review', label: 'Same payment' };
  if (facts.maybeDuplicate) return { tone: 'review', label: 'Maybe a duplicate' };
  if (facts.timesFiled >= USUAL_AFTER) return { tone: 'onTrack', label: 'Usual for you' };
  if (facts.timesFiled >= 1) return { tone: 'onTrack', label: 'Seen before' };
  return null;
}

export type ReviewedProposal = ProposedTransaction & { status: 'approved' | 'rejected'; reviewedAt: string };
export type RejectedProposal = ReviewedProposal & { status: 'rejected' };

/** The decided captures among `proposals`: Approve or Not mine, with the time it was decided. */
export function reviewedProposals(proposals: readonly ProposedTransaction[]): ReviewedProposal[] {
  return proposals.flatMap((proposal) => {
    const { status, reviewedAt } = proposal;
    return (status === 'approved' || status === 'rejected') && reviewedAt ? [{ ...proposal, status, reviewedAt }] : [];
  });
}

/** Recently reviewed: the last 30 days of decisions, newest first. */
export function reviewedLately(proposals: readonly ProposedTransaction[], now: Date): ReviewedProposal[] {
  const since = now.getTime() - REVIEW_HISTORY_DAYS * DAY_MS;
  return reviewedProposals(proposals)
    .filter((proposal) => Date.parse(proposal.reviewedAt) >= since)
    .sort((a, b) => Date.parse(b.reviewedAt) - Date.parse(a.reviewedAt));
}

/**
 * What an Approve row in Recently reviewed shows: the ledger row the approval created, read as it is now,
 * so a category set by the routine match or changed after approval shows. Null for Not mine, or when that
 * row has since been deleted.
 */
export function approvedRow(
  proposal: ReviewedProposal,
  transactionsById: Record<string, FinanceTransaction>,
  lookups: RowLookups & { aliases: readonly Pick<MerchantAlias, 'rawKey' | 'displayName'>[] },
): TransactionRow | null {
  const transaction = proposal.status === 'approved' && proposal.transactionId ? transactionsById[proposal.transactionId] : undefined;
  if (!transaction) return null;
  return transactionRow({ ...transaction, merchant: merchantName(transaction.merchant, lookups.aliases) }, lookups);
}

function alertApp(metadata: Record<string, unknown>): string | null {
  const alert = metadata.alert as { key?: unknown } | undefined;
  if (typeof alert?.key !== 'string') return null;
  try {
    const [app] = JSON.parse(alert.key) as unknown[];
    return typeof app === 'string' && app ? app : null;
  } catch {
    return null;
  }
}

/**
 * The rule preview for "Don't ask about similar": this month's filed bank alerts the rule would have
 * added, newest first. An alert that kept its key must come from the same app; an older one without
 * a key counts when it was filed to the rule's wallet.
 */
export function similarMatches(
  proposal: ProposedTransaction,
  edits: ReviewEdits,
  transactions: readonly FinanceTransaction[],
  month: string,
  calendar: Calendar,
): FinanceTransaction[] {
  const rule = similarRule(proposal, edits);
  if (!rule) return [];
  return transactions
    .filter((transaction) => {
      if (transaction.type !== 'expense' || !isFiled(transaction) || transaction.metadata.source !== 'notification') return false;
      if (!transaction.metadata.alert || merchantKey(transaction.merchant) !== rule.merchantKey) return false;
      if (calendar.monthKey(transaction.transactionDate) !== month) return false;
      const app = alertApp(transaction.metadata);
      return app ? app === rule.sourceApp : transaction.walletId === rule.walletId;
    })
    .sort((a, b) => b.transactionDate.localeCompare(a.transactionDate));
}

/** What the user filed at this merchant this month, newest first: the capture's history when no rule is shown. */
export function merchantHistory(
  proposal: Pick<ProposedTransaction, 'merchant' | 'currency'>,
  transactions: readonly FinanceTransaction[],
  month: string,
  calendar: Calendar,
): FinanceTransaction[] {
  const key = merchantKey(proposal.merchant);
  if (!key) return [];
  return transactions
    .filter(
      (transaction) =>
        isFiled(transaction) &&
        transaction.currency === proposal.currency &&
        merchantKey(transaction.merchant) === key &&
        calendar.monthKey(transaction.transactionDate) === month,
    )
    .sort((a, b) => b.transactionDate.localeCompare(a.transactionDate));
}

/** The Review inbox: waiting captures, oldest first by when the payment happened, so the longest wait goes first. */
export function inboxOrder<P extends Pick<ProposedTransaction, 'transactionDate' | 'createdAt' | 'id'>>(waiting: readonly P[]): P[] {
  const at = (capture: P) => Date.parse(capture.transactionDate ?? capture.createdAt);
  return [...waiting].sort((a, b) => at(a) - at(b) || a.id.localeCompare(b.id));
}
