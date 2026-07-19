import { z } from 'zod';
import type { Pagination } from './api';
import { currencyCodeSchema, positiveMinorAmountSchema } from './money';

// Transaction type enum
export const transactionTypeSchema = z.enum(['income', 'expense', 'transfer']);

// Transaction metadata schema
export const transactionMetadataSchema = z
  .object({
    ai_suggested: z.boolean().optional(),
    ai_confidence: z.number().min(0).max(1).optional(),
    tags: z.array(z.string()).optional(),
  })
  .passthrough(); // Allow additional properties for future use

// Transaction schema
export const transactionSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  walletId: z.string().uuid(),
  amountMinor: positiveMinorAmountSchema,
  /** Immutable snapshot of the source wallet currency. */
  currency: currencyCodeSchema,
  type: transactionTypeSchema,
  categoryId: z.string().uuid().nullable(),

  // Transfer fields
  transferToWalletId: z.string().uuid().nullable(),
  linkedTransactionId: z.string().uuid().nullable(),
  /** Cash movement is real, but should not be treated as personal spending. */
  analysisExcluded: z.boolean(),
  debtActivityId: z.string().uuid().nullable(),

  // Details
  description: z.string().max(500).nullable(),
  merchant: z.string().max(200).nullable(),
  notes: z.string().max(1000).nullable(),

  // Temporal
  transactionDate: z.string().datetime(),

  // Location
  locationLatitude: z.number().min(-90).max(90).nullable(),
  locationLongitude: z.number().min(-180).max(180).nullable(),
  locationName: z.string().max(200).nullable(),

  // Receipt
  receiptImageUrl: z.string().url().nullable(),

  // Metadata
  metadata: transactionMetadataSchema,

  // Timestamps
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

// Create transaction schema
export const createTransactionSchema = z
  .object({
    walletId: z.string().uuid(),
    amountMinor: positiveMinorAmountSchema,
    type: transactionTypeSchema,
    analysisExcluded: z.boolean().optional(),
    debtActivityId: z.string().uuid().optional().nullable(),
    categoryId: z.string().uuid().optional().nullable(),
    transferToWalletId: z.string().uuid().optional().nullable(),
    description: z.string().max(500).optional().nullable(),
    merchant: z.string().max(200).optional().nullable(),
    notes: z.string().max(1000).optional().nullable(),
    transactionDate: z.string().datetime().optional(),
    locationLatitude: z.number().min(-90).max(90).optional().nullable(),
    locationLongitude: z.number().min(-180).max(180).optional().nullable(),
    locationName: z.string().max(200).optional().nullable(),
    tagIds: z.array(z.string().uuid()).optional(),
  })
  .refine((data) => data.type !== 'transfer' || data.transferToWalletId, {
    message: 'Transfer must have target wallet',
    path: ['transferToWalletId'],
  });

// Update transaction schema
export const updateTransactionSchema = z
  .object({
    walletId: z.string().uuid().optional(),
    amountMinor: positiveMinorAmountSchema.optional(),
    type: transactionTypeSchema.optional(),
    analysisExcluded: z.boolean().optional(),
    categoryId: z.string().uuid().optional().nullable(),
    transferToWalletId: z.string().uuid().optional().nullable(),
    description: z.string().max(500).optional().nullable(),
    merchant: z.string().max(200).optional().nullable(),
    notes: z.string().max(1000).optional().nullable(),
    transactionDate: z.string().datetime().optional(),
    locationLatitude: z.number().min(-90).max(90).optional().nullable(),
    locationLongitude: z.number().min(-180).max(180).optional().nullable(),
    locationName: z.string().max(200).optional().nullable(),
    tagIds: z.array(z.string().uuid()).optional(),
  })
  .refine((data) => data.type !== 'transfer' || data.transferToWalletId, {
    message: 'Transfer must have target wallet',
    path: ['transferToWalletId'],
  });

// Transaction list params schema
export const transactionListParamsSchema = z.object({
  walletId: z.string().uuid().optional(),
  categoryId: z.string().uuid().optional(),
  type: transactionTypeSchema.optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  minAmountMinor: z.number().int().nonnegative().optional(),
  maxAmountMinor: z.number().int().nonnegative().optional(),
  search: z.string().optional(),
  tagIds: z.array(z.string().uuid()).optional(),
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(50),
  sortBy: z.enum(['date', 'amount', 'merchant']).optional().default('date'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

// Type inference
export type TransactionType = z.infer<typeof transactionTypeSchema>;
export type TransactionMetadata = z.infer<typeof transactionMetadataSchema>;
export type Transaction = z.infer<typeof transactionSchema>;
export type CreateTransaction = z.infer<typeof createTransactionSchema>;
export type UpdateTransaction = z.infer<typeof updateTransactionSchema>;
export type TransactionListParams = z.infer<typeof transactionListParamsSchema>;

// API Response types
export type TransactionResponse = {
  transaction: Transaction;
};

export type TransactionListResponse = {
  transactions: Transaction[];
  pagination: Pagination;
};

// Transaction with relations
export type TransactionWithRelations = Transaction & {
  wallet?: {
    id: string;
    name: string;
    type: string;
    color: string;
    icon: string;
  };
  category?: {
    id: string;
    name: string;
    icon: string;
    color: string;
  };
  tags?: Array<{
    id: string;
    name: string;
    color: string;
  }>;
  transferToWallet?: {
    id: string;
    name: string;
    type: string;
    color: string;
    icon: string;
  };
};
