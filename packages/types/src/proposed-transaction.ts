import { z } from 'zod';
import { transactionTypeSchema } from './transaction';
import { currencyCodeSchema, positiveMinorAmountSchema } from './money';

/**
 * `pending` and `later` are unreviewed; a `later` row comes back once `snoozedUntil` passes.
 * Approve and Not mine stamp their status and `reviewedAt` and keep the row as review history.
 */
export const proposedTransactionStatusSchema = z.enum(['pending', 'later', 'rejected', 'approved']);
export const proposedTransactionSourceTypeSchema = z.enum(['notification', 'text', 'image']);

/** What was captured and what Moni read from it, before any decision. */
const capturedFieldsSchema = z.object({
  // Source metadata
  sourceType: proposedTransactionSourceTypeSchema,
  sourceApp: z.string().nullable(),
  sourceText: z.string().nullable(),
  sourceImageUri: z.string().nullable(),
  notificationTitle: z.string().nullable(),
  notificationBody: z.string().nullable(),
  notificationReceivedAt: z.string().datetime({ offset: true }).nullable(),

  // AI analysis
  aiReasoning: z.string().nullable(),
  aiConfidence: z.number().min(0).max(1).nullable(),

  // Proposed transaction data (may be partial if AI isn't certain)
  walletId: z.string().uuid().nullable(),
  walletHint: z.string().nullable(),
  transferToWalletId: z.string().uuid().nullable(),
  transferToWalletHint: z.string().nullable(),
  amountMinor: positiveMinorAmountSchema.nullable(),
  currency: currencyCodeSchema,
  type: transactionTypeSchema.nullable(),
  description: z.string().nullable(),
  merchant: z.string().nullable(),
  categoryId: z.string().uuid().nullable(),
  categoryHint: z.string().nullable(),
  transactionDate: z.string().datetime({ offset: true }).nullable(),
});

/** One payment counted once: `same_purchase` is two captures of a purchase, `transfer_pair` the two legs of a transfer. */
export const pairKindSchema = z.enum(['same_purchase', 'transfer_pair']);

/**
 * A capture folded into another row, stored whole on that row so it stays visible and Undo can
 * bring it back. One slot per row, so a third identical payment can never fold into the same row.
 */
export const capturePairingSchema = z.object({
  kind: pairKindSchema,
  /** `id` is the capture's: its capture log entry, and the proposal it becomes on Undo. */
  absorbed: capturedFieldsSchema.extend({ id: z.string().min(1) }),
  /** The row's columns this pairing changed, as they stood, for Undo. */
  before: z.record(z.unknown()),
  /** Set on a ledger row the pairing created by completing a Review capture. */
  promotedFromProposalId: z.string().optional(),
});

export const proposedTransactionSchema = capturedFieldsSchema.extend({
  id: z.string().uuid(),
  userId: z.string().uuid(),

  status: proposedTransactionStatusSchema,
  snoozedUntil: z.string().datetime().nullable().optional(),
  /** Set by Approve and Not mine; cleared when the capture goes back to review. */
  reviewedAt: z.string().datetime().nullable().optional(),
  /** The ledger row Approve created; null for Not mine and once that row is deleted. */
  transactionId: z.string().uuid().nullable().optional(),
  /** The capture this one absorbed, shown on the card and carried to the ledger row. */
  pairing: capturePairingSchema.nullable().optional(),

  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const createProposedTransactionSchema = proposedTransactionSchema.omit({
  id: true,
  userId: true,
  reviewedAt: true,
  transactionId: true,
  pairing: true,
  createdAt: true,
  updatedAt: true,
});

export type PairKind = z.infer<typeof pairKindSchema>;
export type CapturePairing = z.infer<typeof capturePairingSchema>;
export type AbsorbedCapture = CapturePairing['absorbed'];
export type ProposedTransactionSourceType = z.infer<typeof proposedTransactionSourceTypeSchema>;
export type ProposedTransactionStatus = z.infer<typeof proposedTransactionStatusSchema>;
export type ProposedTransaction = z.infer<typeof proposedTransactionSchema>;
export type CreateProposedTransaction = z.infer<typeof createProposedTransactionSchema>;

export type ProposedTransactionListResponse = {
  proposedTransactions: ProposedTransaction[];
};
