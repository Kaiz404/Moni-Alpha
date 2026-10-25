import { z } from 'zod';
import { transactionTypeSchema } from './transaction';
import { currencyCodeSchema, positiveMinorAmountSchema } from './money';

/**
 * `pending` and `later` are unreviewed; a `later` row comes back once `snoozedUntil` passes.
 * Approve and Not mine stamp their status and `reviewedAt` and keep the row as review history.
 */
export const proposedTransactionStatusSchema = z.enum(['pending', 'later', 'rejected', 'approved']);
export const proposedTransactionSourceTypeSchema = z.enum(['notification', 'text', 'image']);

export const proposedTransactionSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),

  // Source metadata
  sourceType: proposedTransactionSourceTypeSchema,
  sourceApp: z.string().nullable(),
  sourceText: z.string().nullable(),
  sourceImageUri: z.string().nullable(),
  notificationTitle: z.string().nullable(),
  notificationBody: z.string().nullable(),
  notificationReceivedAt: z.string().datetime().nullable(),

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
  transactionDate: z.string().datetime().nullable(),

  status: proposedTransactionStatusSchema,
  snoozedUntil: z.string().datetime().nullable().optional(),
  /** Set by Approve and Not mine; cleared when the capture goes back to review. */
  reviewedAt: z.string().datetime().nullable().optional(),
  /** The ledger row Approve created; null for Not mine and once that row is deleted. */
  transactionId: z.string().uuid().nullable().optional(),

  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const createProposedTransactionSchema = proposedTransactionSchema.omit({
  id: true,
  userId: true,
  reviewedAt: true,
  transactionId: true,
  createdAt: true,
  updatedAt: true,
});

export type ProposedTransactionSourceType = z.infer<typeof proposedTransactionSourceTypeSchema>;
export type ProposedTransactionStatus = z.infer<typeof proposedTransactionStatusSchema>;
export type ProposedTransaction = z.infer<typeof proposedTransactionSchema>;
export type CreateProposedTransaction = z.infer<typeof createProposedTransactionSchema>;

export type ProposedTransactionListResponse = {
  proposedTransactions: ProposedTransaction[];
};
