import { z } from 'zod';

// Sync action enum
export const syncActionSchema = z.enum(['create', 'update', 'delete']);

// Entity type enum
export const syncEntityTypeSchema = z.enum([
  'wallet',
  'transaction',
  'category',
  'tag',
]);

// Sync change schema (generic)
export const syncChangeSchema = z.object({
  id: z.string().uuid(),
  entityType: syncEntityTypeSchema,
  action: syncActionSchema,
  data: z.any(), // Entity-specific data
  localTimestamp: z.number().int().positive(), // Unix timestamp
});

// Wallet sync change
export const walletSyncChangeSchema = z.object({
  id: z.string().uuid(),
  action: syncActionSchema,
  data: z.any(), // Will be validated against wallet schema
});

// Transaction sync change
export const transactionSyncChangeSchema = z.object({
  id: z.string().uuid(),
  action: syncActionSchema,
  data: z.any(), // Will be validated against transaction schema
});

// Category sync change
export const categorySyncChangeSchema = z.object({
  id: z.string().uuid(),
  action: syncActionSchema,
  data: z.any(), // Will be validated against category schema
});

// Tag sync change
export const tagSyncChangeSchema = z.object({
  id: z.string().uuid(),
  action: syncActionSchema,
  data: z.any(), // Will be validated against tag schema
});

// Push request schema
export const syncPushRequestSchema = z.object({
  wallets: z.array(walletSyncChangeSchema).optional(),
  transactions: z.array(transactionSyncChangeSchema).optional(),
  categories: z.array(categorySyncChangeSchema).optional(),
  tags: z.array(tagSyncChangeSchema).optional(),
  lastSyncTimestamp: z.number().int().nonnegative().optional(),
});

// Pull request schema
export const syncPullRequestSchema = z.object({
  lastSyncTimestamp: z.number().int().nonnegative().optional(),
  entityTypes: z.array(syncEntityTypeSchema).optional(), // If not provided, pull all
});

// Sync result for individual entity
export const syncEntityResultSchema = z.object({
  localId: z.string().uuid(),
  serverId: z.string().uuid().optional(),
  status: z.enum(['created', 'updated', 'deleted', 'conflict', 'error']),
  error: z.string().optional(),
});

// Push response schema
export const syncPushResponseSchema = z.object({
  success: z.boolean(),
  timestamp: z.number().int().positive(),
  results: z.object({
    wallets: z.array(syncEntityResultSchema),
    transactions: z.array(syncEntityResultSchema),
    categories: z.array(syncEntityResultSchema),
    tags: z.array(syncEntityResultSchema),
  }),
});

// Pull response schema
export const syncPullResponseSchema = z.object({
  wallets: z.object({
    created: z.array(z.any()),
    updated: z.array(z.any()),
    deleted: z.array(z.string().uuid()),
  }),
  transactions: z.object({
    created: z.array(z.any()),
    updated: z.array(z.any()),
    deleted: z.array(z.string().uuid()),
  }),
  categories: z.object({
    created: z.array(z.any()),
    updated: z.array(z.any()),
    deleted: z.array(z.string().uuid()),
  }),
  tags: z.object({
    created: z.array(z.any()),
    updated: z.array(z.any()),
    deleted: z.array(z.string().uuid()),
  }),
  timestamp: z.number().int().positive(),
});

// Conflict resolution schema
export const syncConflictResolutionSchema = z.object({
  entityType: syncEntityTypeSchema,
  entityId: z.string().uuid(),
  resolution: z.enum(['use_local', 'use_server', 'merge']),
  mergedData: z.any().optional(), // Required if resolution is 'merge'
});

// Type inference
export type SyncAction = z.infer<typeof syncActionSchema>;
export type SyncEntityType = z.infer<typeof syncEntityTypeSchema>;
export type SyncChange = z.infer<typeof syncChangeSchema>;
export type WalletSyncChange = z.infer<typeof walletSyncChangeSchema>;
export type TransactionSyncChange = z.infer<typeof transactionSyncChangeSchema>;
export type CategorySyncChange = z.infer<typeof categorySyncChangeSchema>;
export type TagSyncChange = z.infer<typeof tagSyncChangeSchema>;
export type SyncPushRequest = z.infer<typeof syncPushRequestSchema>;
export type SyncPullRequest = z.infer<typeof syncPullRequestSchema>;
export type SyncEntityResult = z.infer<typeof syncEntityResultSchema>;
export type SyncPushResponse = z.infer<typeof syncPushResponseSchema>;
export type SyncPullResponse = z.infer<typeof syncPullResponseSchema>;
export type SyncConflictResolution = z.infer<typeof syncConflictResolutionSchema>;
