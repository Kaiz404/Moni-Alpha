/**
 * Counts one payment once: folds a capture into another row, keeping all of it there so it stays
 * visible and Undo can bring it back. The one path for automatic pairing (run-extraction) and for
 * the Review card's controls. See docs/AI.md, "Duplicate detection".
 */
import type { AbsorbedCapture, CapturePairing, ProposedTransaction } from '@repo/types';
import { capturePairingSchema } from '@repo/types';

import type { DuplicateMatch } from '@/lib/ai/duplicates';
import { markCaptureStatus } from '@/lib/notifications/capture-status';
import { emitProposedTransactionsChanged } from '@/lib/proposals/proposed-transactions-events';
import { isMigrated, proposedTransactions$, transactions$ } from '@/lib/store';
import { getRecordValues, patchRow } from '@/lib/store/helpers';
import {
  approveProposedTransaction,
  createProposedTransaction,
  retireProposal,
  type ProposedTransactionRow,
  rowToProposedTransaction,
} from '@/lib/supabase/proposed-transactions';
import { deleteTransaction } from '@/lib/supabase/transactions';
import {
  alertKey,
  captureAlert,
  parseMetadata,
  transactionAlert,
  transactionPairing,
} from '@/lib/transactions/alert';

type Row = Record<string, unknown> & { id: string };

/** A Review row can only hold a pairing once its column exists; a ledger row uses `metadata`. */
export function canPairInto(match: DuplicateMatch): boolean {
  return match.target.kind === 'transaction' || isMigrated('capture_pairing');
}

/** A synced row can miss a column that was added later; a stored capture always has every field. */
export function toAbsorbedCapture(
  proposal: Pick<AbsorbedCapture, 'id' | 'sourceType' | 'currency'> &
    Partial<Omit<AbsorbedCapture, 'id' | 'sourceType' | 'currency'>>,
): AbsorbedCapture {
  return {
    id: proposal.id,
    sourceType: proposal.sourceType,
    sourceApp: proposal.sourceApp ?? null,
    sourceText: proposal.sourceText ?? null,
    sourceImageUri: proposal.sourceImageUri ?? null,
    notificationTitle: proposal.notificationTitle ?? null,
    notificationBody: proposal.notificationBody ?? null,
    notificationReceivedAt: proposal.notificationReceivedAt ?? null,
    aiReasoning: proposal.aiReasoning ?? null,
    aiConfidence: proposal.aiConfidence ?? null,
    walletId: proposal.walletId ?? null,
    walletHint: proposal.walletHint ?? null,
    transferToWalletId: proposal.transferToWalletId ?? null,
    transferToWalletHint: proposal.transferToWalletHint ?? null,
    amountMinor: proposal.amountMinor ?? null,
    currency: proposal.currency,
    type: proposal.type ?? null,
    description: proposal.description ?? null,
    merchant: proposal.merchant ?? null,
    categoryId: proposal.categoryId ?? null,
    categoryHint: proposal.categoryHint ?? null,
    transactionDate: proposal.transactionDate ?? null,
  };
}

function pairingOf(row: Row, kind: DuplicateMatch['target']['kind']): CapturePairing | null {
  return kind === 'transaction'
    ? transactionPairing(row.metadata)
    : (capturePairingSchema.safeParse(row.pairing).data ?? null);
}

function isAutoAdded(row: Row): boolean {
  return parseMetadata(row.metadata).ai_suggested === true;
}

/**
 * The columns the pairing sets, only where they change. Either arrival order lands on the same
 * row: the bank's wallet, because that is the money that moved, and the e-wallet's merchant,
 * because it names the shop. A ledger row the user already reviewed keeps their merchant and category.
 */
function pairedColumns(
  row: Row,
  capture: AbsorbedCapture,
  match: DuplicateMatch,
): Record<string, unknown> {
  const next: Record<string, unknown> = {};
  if (match.kind === 'transfer_pair') {
    next.type = 'transfer';
    next.wallet_id = match.fromWalletId;
    next.transfer_to_wallet_id = match.toWalletId;
    next.category_id = null;
    next.merchant = null;
    if (capture.type === 'transfer' && row.type !== 'transfer') next.description = capture.description;
  } else {
    const reviewed = match.target.kind === 'transaction' && !isAutoAdded(row);
    if (match.walletId) next.wallet_id = match.walletId;
    if (match.preferCandidate && !reviewed) {
      next.merchant = capture.merchant ?? row.merchant ?? null;
      next.category_id = capture.categoryId ?? row.category_id ?? null;
    } else {
      next.merchant = row.merchant ?? capture.merchant;
      next.category_id = row.category_id ?? capture.categoryId;
    }
    const image = capture.sourceImageUri?.startsWith('http') ? capture.sourceImageUri : null;
    const imageColumn = match.target.kind === 'transaction' ? 'receipt_image_url' : 'source_image_uri';
    if (image && !row[imageColumn]) next[imageColumn] = image;
  }
  return Object.fromEntries(
    Object.entries(next).filter(([column, value]) => (row[column] ?? null) !== (value ?? null)),
  );
}

function table$(kind: DuplicateMatch['target']['kind']) {
  return kind === 'transaction' ? transactions$ : proposedTransactions$;
}

function readRow(kind: DuplicateMatch['target']['kind'], id: string): Row | null {
  return getRecordValues<Row>(table$(kind)).find((row) => row.id === id) ?? null;
}

/**
 * A transfer pair names both wallets, so a Review capture it completes needs no decision and joins
 * the ledger, the same as when the bank's alert arrives first.
 */
async function completeTransfer(id: string, pairing: CapturePairing): Promise<string> {
  const row = readRow('proposal', id) as ProposedTransactionRow | null;
  if (!row) throw new Error(`Cannot complete missing proposal: ${id}`);
  const proposal: ProposedTransaction = {
    ...rowToProposedTransaction(row),
    pairing: { ...pairing, promotedFromProposalId: id },
  };
  const transactionId = await approveProposedTransaction(
    proposal,
    { walletId: proposal.walletId!, transferToWalletId: proposal.transferToWalletId },
    captureAlert(proposal, id),
    { automatically: true },
  );
  if (proposal.sourceType === 'notification') markCaptureStatus(id, 'auto_added', transactionId);
  return transactionId;
}

/**
 * Throws before writing anything when the capture can't be stored whole, so the caller can leave it
 * in Review. Sets values only, so a second run for the same capture changes nothing.
 */
export async function pairCapture(capture: AbsorbedCapture, match: DuplicateMatch): Promise<void> {
  const { kind, id } = match.target;
  const row = readRow(kind, id);
  if (!row) throw new Error(`Cannot pair with missing ${kind}: ${id}`);
  const held = pairingOf(row, kind);
  if (held?.absorbed.id === capture.id) return;
  if (held) throw new Error(`Row already counts two captures: ${id}`);

  const columns = pairedColumns(row, capture, match);
  const pairing = capturePairingSchema.parse({
    kind: match.kind,
    absorbed: capture,
    before: Object.fromEntries(Object.keys(columns).map((column) => [column, row[column] ?? null])),
  });
  const updated_at = new Date().toISOString();
  let transactionId = kind === 'transaction' ? id : undefined;
  let waitingIn: string | undefined;
  if (kind === 'transaction') {
    patchRow(transactions$, id, {
      ...columns,
      metadata: {
        ...parseMetadata(row.metadata),
        pairing,
        ...(match.kind === 'transfer_pair' ? { ai_suggested: true } : {}),
      },
      updated_at,
    });
  } else {
    patchRow(proposedTransactions$, id, { ...columns, pairing, updated_at });
    if (match.kind === 'transfer_pair') transactionId = await completeTransfer(id, pairing);
    else waitingIn = id;
  }
  retireProposal(capture.id);
  if (capture.sourceType === 'notification') {
    markCaptureStatus(capture.id, 'same_payment', transactionId, waitingIn);
  }
  emitProposedTransactionsChanged();
}

function findHolder(captureId: string):
  | { kind: 'transaction' | 'proposal'; row: Row; pairing: CapturePairing }
  | null {
  for (const kind of ['transaction', 'proposal'] as const) {
    for (const row of getRecordValues<Row>(table$(kind))) {
      const pairing = pairingOf(row, kind);
      if (pairing?.absorbed.id === captureId) return { kind, row, pairing };
    }
  }
  return null;
}

/**
 * Makes the alert its own capture again, in Review, and puts the row that held it back. Moni only
 * pairs an alert when it first reads it, so the capture stays apart until the user decides.
 * False when that row is gone, as after the user deleted the transaction.
 */
export async function undoPairing(captureId: string): Promise<boolean> {
  const holder = findHolder(captureId);
  if (!holder) return false;
  const { kind, row, pairing } = holder;
  const updated_at = new Date().toISOString();
  const promotedFrom = pairing.promotedFromProposalId;
  if (promotedFrom) {
    await deleteTransaction(row.id);
    patchRow(proposedTransactions$, promotedFrom, {
      ...pairing.before,
      pairing: null,
      status: 'pending',
      reviewed_at: null,
      transaction_id: null,
      updated_at,
    });
    markCaptureStatus(promotedFrom, 'waiting_for_review');
  } else if (kind === 'transaction') {
    const { pairing: _dropped, ...metadata } = parseMetadata(row.metadata);
    const { source_image_uri: _notALedgerColumn, ...before } = pairing.before;
    patchRow(transactions$, row.id, { ...before, metadata, updated_at });
  } else {
    patchRow(proposedTransactions$, row.id, { ...pairing.before, pairing: null, updated_at });
  }
  const { id, ...absorbed } = pairing.absorbed;
  await createProposedTransaction({ ...absorbed, status: 'pending' }, { id });
  if (absorbed.sourceType === 'notification') markCaptureStatus(id, 'waiting_for_review');
  emitProposedTransactionsChanged();
  return true;
}

export type ProcessedAlert = {
  created: boolean;
  skipped: boolean;
  reason: string;
  proposalId?: string;
  transactionId?: string;
  paired?: boolean;
};

/**
 * The outcome to report when this exact delivery was already handled, or null. A rerun of the same
 * queue item reports what it did before; a redelivery under a new capture id is skipped and logged Ignored.
 */
export function findProcessedAlert(key: string, captureId: string): ProcessedAlert | null {
  const skipped = { created: false, skipped: true, reason: 'Redelivered notification' };
  for (const row of getRecordValues<ProposedTransactionRow>(proposedTransactions$)) {
    const proposal = rowToProposedTransaction(row);
    if (proposal.sourceType === 'notification' && alertKey(proposal) === key) {
      return proposal.id === captureId
        ? { created: true, skipped: false, reason: 'Already processed', proposalId: proposal.id }
        : skipped;
    }
    const absorbed = proposal.pairing?.absorbed;
    if (absorbed && alertKey(absorbed) === key) {
      return absorbed.id === captureId
        ? { created: true, skipped: false, reason: 'Already processed', paired: true }
        : skipped;
    }
  }
  for (const row of getRecordValues<Row>(transactions$)) {
    const alert = transactionAlert(row.metadata);
    if (alert?.key === key) {
      return alert.captureId === captureId
        ? { created: true, skipped: false, reason: 'Already processed', transactionId: row.id }
        : skipped;
    }
    const absorbed = transactionPairing(row.metadata)?.absorbed;
    if (absorbed && alertKey(absorbed) === key) {
      return absorbed.id === captureId
        ? { created: true, skipped: false, reason: 'Already processed', paired: true }
        : skipped;
    }
  }
  return null;
}
