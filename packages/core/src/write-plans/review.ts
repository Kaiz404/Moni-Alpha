import {
  capturePairingSchema,
  transactionAlertSchema,
  type CapturedNotificationStatus,
  type MinorAmount,
  type ProposedTransaction,
  type ProposedTransactionSourceType,
  type TransactionAlert,
  type TransactionSource,
  type TransactionType,
} from '@repo/types';

import { isFiled } from '../ledger';
import { merchantKey } from '../read-model/merchants';
import type { FinanceTransaction } from '../read-model/types';
import { checkTransfer, planTransaction } from './transactions';
import {
  planned,
  refused,
  type LedgerView,
  type PlanContext,
  type Planned,
  type RowWrites,
  type StoredRow,
} from './types';

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

type AlertDelivery = Pick<ProposedTransaction, 'sourceApp' | 'notificationTitle' | 'notificationBody' | 'notificationReceivedAt'>;

/**
 * Which delivery of which alert: a redelivered notification repeats all four parts, because
 * `notificationReceivedAt` is Android's post time. Two real payments differ at least in that.
 */
export function alertKey(alert: AlertDelivery): string {
  return JSON.stringify([
    alert.sourceApp ?? '',
    alert.notificationTitle ?? '',
    alert.notificationBody ?? '',
    // Postgres hands the timestamp back in another format, so compare the instant.
    alert.notificationReceivedAt ? Date.parse(alert.notificationReceivedAt) : null,
  ]);
}

/** The bank alert a notification capture keeps on the ledger row it becomes, read before any edit. */
export function captureAlert(
  proposal: AlertDelivery & Pick<ProposedTransaction, 'sourceType' | 'amountMinor' | 'currency'>,
  captureId?: string,
): TransactionAlert | undefined {
  if (proposal.sourceType !== 'notification') return undefined;
  const parsed = transactionAlertSchema.safeParse({
    text: proposal.notificationBody?.trim().slice(0, 1000),
    amountMinor: proposal.amountMinor,
    currency: proposal.currency,
    key: alertKey(proposal),
    captureId,
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
 * What the user changed on a capture before deciding. A field left undefined keeps the proposal's
 * value; `walletId: null` means no wallet is picked yet.
 */
export type ReviewEdits = {
  amountMinor?: MinorAmount;
  merchant?: string;
  categoryId?: string | null;
  walletId?: string | null;
  transferToWalletId?: string | null;
  /** The capture was read as the wrong type. */
  type?: TransactionType;
};

/** The capture as it will be written, edits applied. A transfer has no merchant and no category. */
export function editedProposal<P extends ProposedTransaction>(proposal: P, edits: ReviewEdits): P {
  const type = edits.type ?? proposal.type;
  const transfer = type === 'transfer';
  const merchant = edits.merchant === undefined ? proposal.merchant : edits.merchant.trim() || null;
  return {
    ...proposal,
    type,
    amountMinor: edits.amountMinor ?? proposal.amountMinor,
    merchant: transfer ? null : merchant,
    categoryId: transfer ? null : edits.categoryId === undefined ? proposal.categoryId : edits.categoryId,
    walletId: edits.walletId === undefined ? proposal.walletId : edits.walletId,
    transferToWalletId: !transfer
      ? null
      : edits.transferToWalletId === undefined
        ? proposal.transferToWalletId
        : edits.transferToWalletId,
  };
}

/**
 * The capture was read as the wrong type. A category belongs to one type, so it goes; going back to
 * the type Moni read brings back the category it read with it.
 */
export function retypeEdits(proposal: Pick<ProposedTransaction, 'type'>, next: TransactionType): ReviewEdits {
  return next === proposal.type ? { type: undefined, categoryId: undefined } : { type: next, categoryId: null };
}

/**
 * A decision on one capture: Approve or Not mine, the only two (issue #69). `similar` is "Don't ask
 * about similar"; `automatically` marks a capture Moni completed without asking.
 */
export type ReviewDecision =
  | {
      kind: 'approve';
      edits?: ReviewEdits;
      similar?: boolean;
      automatically?: boolean;
      /** Where the phone was when the capture arrived, which only the phone knows. */
      place?: { latitude: number; longitude: number; name: string | null } | null;
    }
  | { kind: 'notMine' };

/**
 * A status for an entry in the phone's capture log, which lives on the device. The web has no log
 * and ignores these; the phone's adapter writes each one.
 */
export type CaptureMark = {
  captureId: string;
  status: CapturedNotificationStatus;
  transactionId?: string;
  pairedProposalId?: string;
};

/** What a decision did, plain JSON so a notification's Undo can carry it. */
export type ReviewChanges = {
  decision: ReviewDecision['kind'];
  /** The ledger row an Approve wrote. */
  transactionId: string | null;
  /** The auto-add rule "Don't ask about similar" saved, and whether this decision created it. */
  rule: { id: string; created: boolean } | null;
  captureMarks: CaptureMark[];
};

/**
 * Who decides and when, and which migrations the rows need: without `reviewHistory` a decided capture
 * is soft-deleted, and without `autoAddRules` no rule is saved.
 */
export type ReviewContext = PlanContext & { reviewHistory: boolean; autoAddRules: boolean };

/** The ledger a decision reads: the wallets, and the live auto-add rules for "Don't ask about similar". */
export type ReviewView = Pick<LedgerView, 'walletsById'> & {
  autoAddRules: readonly StoredRow<'auto_add_rules'>[];
};

function closeMarks(proposal: ProposedTransaction, status: 'added' | 'auto_added' | 'ignored', transactionId: string | null): CaptureMark[] {
  const marks: CaptureMark[] = [];
  const linked = transactionId ? { transactionId } : {};
  // A notification's capture is stored under the id of its capture log entry.
  if (proposal.sourceType === 'notification') marks.push({ captureId: proposal.id, status, ...linked });
  const absorbed = proposal.pairing?.absorbed;
  if (absorbed?.sourceType === 'notification') {
    marks.push({ captureId: absorbed.id, status: status === 'ignored' ? 'ignored' : 'same_payment', ...linked });
  }
  return marks;
}

function closeCapture(id: string, status: 'approved' | 'rejected', transactionId: string | null, ctx: ReviewContext): Partial<RowWrites> {
  if (!ctx.reviewHistory) {
    return {
      patch: [{ table: 'proposed_transactions', id, patch: { status, updated_at: ctx.now } }],
      softDelete: [{ table: 'proposed_transactions', id, at: ctx.now }],
    };
  }
  return {
    patch: [
      {
        table: 'proposed_transactions',
        id,
        patch: { status, reviewed_at: ctx.now, transaction_id: transactionId, updated_at: ctx.now },
      },
    ],
  };
}

export type SimilarRule = { merchantKey: string; sourceApp: string; walletId: string; categoryId: string };

/**
 * The rule "Don't ask about similar" saves: this app's alerts from this merchant go straight to this
 * category and wallet. Only a bank alert with a merchant, a wallet and a category makes one, and never
 * a retyped capture: a rule has no type, so it would file the next alert under the misread one.
 */
export function similarRule(proposal: ProposedTransaction, edits: ReviewEdits = {}): SimilarRule | null {
  const next = editedProposal(proposal, edits);
  const key = merchantKey(next.merchant);
  if (edits.type !== undefined || next.sourceType !== 'notification' || !next.sourceApp || !key) return null;
  if (!next.walletId || !next.categoryId || next.type === 'transfer') return null;
  return { merchantKey: key, sourceApp: next.sourceApp, walletId: next.walletId, categoryId: next.categoryId };
}

/** The live rule for this app and merchant: a device offline can write a second, so the newest wins. */
function liveRule(rule: SimilarRule, rules: readonly StoredRow<'auto_add_rules'>[], userId: string) {
  return rules
    .filter((row) => !row.deleted && row.user_id === userId && row.source_app === rule.sourceApp && row.merchant_key === rule.merchantKey)
    .sort((a, b) => (b.updated_at ?? '').localeCompare(a.updated_at ?? ''))[0];
}

/**
 * "Don't ask about similar" on its own, as the phone's Approved notification offers it after the
 * fact: saves the rule, or updates the live one for this app and merchant. Nothing to write when the
 * capture can't make a rule or the rules table isn't there yet.
 */
export function planSimilarRule(
  proposal: ProposedTransaction,
  edits: ReviewEdits,
  view: ReviewView,
  ctx: ReviewContext,
): Planned<ReviewChanges['rule']> {
  const rule = ctx.autoAddRules ? similarRule(proposal, edits) : null;
  if (!rule) return planned({}, null);
  const fields = { merchant_key: rule.merchantKey, source_app: rule.sourceApp, wallet_id: rule.walletId, category_id: rule.categoryId };
  const live = liveRule(rule, view.autoAddRules, ctx.userId);
  if (live) {
    return planned({ patch: [{ table: 'auto_add_rules', id: live.id, patch: { ...fields, updated_at: ctx.now } }] }, { id: live.id, created: false });
  }
  const id = ctx.newId();
  return planned({ insert: [{ table: 'auto_add_rules', row: { id, user_id: ctx.userId, ...fields, deleted: false } }] }, { id, created: true });
}

function approve(
  proposal: ProposedTransaction,
  decision: Extract<ReviewDecision, { kind: 'approve' }>,
  view: ReviewView,
  ctx: ReviewContext,
): Planned<ReviewChanges> {
  const next = editedProposal(proposal, decision.edits ?? {});
  if (!next.walletId) return { kind: 'needsInput', field: 'wallet' };
  if (!next.type) return refused('Pick a type first.');
  if (next.type === 'transfer') {
    const problem = checkTransfer(view, next.walletId, next.transferToWalletId);
    if (problem) return problem;
  }
  if (!next.amountMinor || next.amountMinor <= 0) return refused('Enter an amount above zero.');
  // The alert is the bank's own words, so it is read from the capture before any edit.
  const alert = captureAlert(proposal, proposal.id);
  const row = planTransaction(
    {
      walletId: next.walletId,
      amountMinor: next.amountMinor,
      type: next.type,
      transferToWalletId: next.type === 'transfer' ? next.transferToWalletId : null,
      categoryId: next.categoryId,
      description: next.description,
      merchant: next.merchant,
      transactionDate: next.transactionDate ?? ctx.now,
      locationLatitude: decision.place?.latitude ?? null,
      locationLongitude: decision.place?.longitude ?? null,
      locationName: decision.place?.name ?? null,
      metadata: {
        ...(alert ? { alert } : {}),
        ...(next.pairing ? { pairing: next.pairing } : {}),
        ...(decision.automatically ? { ai_suggested: true } : {}),
      },
    },
    SOURCE[next.sourceType],
    view,
    ctx,
  );
  if (row.kind !== 'writes') return row;
  const transactionId = row.result.id;
  // A receipt photo already in storage goes with the row; one still uploading is the phone's to link.
  const receipt = next.sourceImageUri?.startsWith('http') ? next.sourceImageUri : null;
  const inserts = row.writes.insert.map((write) =>
    write.table === 'transactions' && receipt ? { ...write, row: { ...write.row, receipt_image_url: receipt } } : write,
  );
  const close = closeCapture(next.id, 'approved', transactionId, ctx);
  const rule = decision.similar ? planSimilarRule(proposal, decision.edits ?? {}, view, ctx) : planned({}, null);
  if (rule.kind !== 'writes') return rule;
  return planned(
    {
      insert: [...inserts, ...rule.writes.insert],
      patch: [...(close.patch ?? []), ...rule.writes.patch],
      softDelete: close.softDelete ?? [],
    },
    {
      decision: 'approve',
      transactionId,
      rule: rule.result,
      captureMarks: closeMarks(next, decision.automatically ? 'auto_added' : 'added', transactionId),
    },
  );
}

/**
 * One decision on one capture: the rows to write and the capture log statuses the phone records.
 * Approve writes the ledger row (with the bank alert and any pairing), closes the capture, and with
 * "Don't ask about similar" saves the rule; Not mine closes the capture. A decided capture refuses a
 * second decision.
 */
export function planReview(
  proposal: ProposedTransaction,
  decision: ReviewDecision,
  view: ReviewView,
  ctx: ReviewContext,
): Planned<ReviewChanges> {
  if (proposal.status === 'approved' || proposal.status === 'rejected') return refused('This capture was already reviewed.');
  if (decision.kind === 'approve') return approve(proposal, decision, view, ctx);
  return planned(closeCapture(proposal.id, 'rejected', null, ctx), {
    decision: 'notMine',
    transactionId: null,
    rule: null,
    captureMarks: closeMarks(proposal, 'ignored', null),
  });
}

/**
 * Undo of a decision: the capture back in Review, the ledger row and a rule the decision created gone,
 * and the capture log back to waiting. `before` is the capture's row as stored before the decision;
 * `live` says whether the store still holds it, since a capture soft-deleted on close is written again
 * whole. Every write sets values, so running it twice converges.
 */
export function planReopen(
  before: StoredRow<'proposed_transactions'>,
  changes: Pick<ReviewChanges, 'transactionId' | 'rule'>,
  live: boolean,
  ctx: Pick<PlanContext, 'now'>,
): Planned<{ captureMarks: CaptureMark[] }> {
  const pending = { status: 'pending', reviewed_at: null, transaction_id: null, updated_at: ctx.now } as const;
  const writes: RowWrites = { insert: [], patch: [], softDelete: [] };
  if (live) writes.patch.push({ table: 'proposed_transactions', id: before.id, patch: pending });
  else writes.insert.push({ table: 'proposed_transactions', row: { ...before, ...pending, deleted: false } });
  if (changes.transactionId) writes.softDelete.push({ table: 'transactions', id: changes.transactionId, at: ctx.now });
  if (changes.rule?.created) writes.softDelete.push({ table: 'auto_add_rules', id: changes.rule.id, at: ctx.now });
  const captureMarks: CaptureMark[] = [];
  if (before.source_type === 'notification') captureMarks.push({ captureId: before.id, status: 'waiting_for_review' });
  const absorbed = capturePairingSchema.safeParse(before.pairing).data?.absorbed;
  if (absorbed?.sourceType === 'notification') {
    captureMarks.push({ captureId: absorbed.id, status: 'same_payment', pairedProposalId: before.id });
  }
  return { kind: 'writes', writes, result: { captureMarks } };
}

/**
 * The way out when Moni read an alert as moving the user's own money and it wasn't: the capture stays
 * in Review with the merchant the alert named. A bank's alert is spending out of that wallet; with no
 * source wallet the alert came from the side the money arrived in.
 */
export function planNotATransfer(proposal: ProposedTransaction, ctx: Pick<PlanContext, 'now'>): Planned<null> {
  return planned(
    {
      patch: [
        {
          table: 'proposed_transactions',
          id: proposal.id,
          patch: {
            type: proposal.walletId ? 'expense' : 'income',
            wallet_id: proposal.walletId ?? proposal.transferToWalletId,
            transfer_to_wallet_id: null,
            description: null,
            updated_at: ctx.now,
          },
        },
      ],
    },
    null,
  );
}
