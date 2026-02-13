import { z } from 'zod';

// Wallet type enum
export const walletTypeSchema = z.enum([
  'bank',
  'cash',
  'credit',
  'debit',
  'ewallet',
  'investment',
  'other',
]);

// Wallet schema
export const walletSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  name: z.string().min(1).max(100),
  type: walletTypeSchema,
  currency: z.string().length(3),
  initialBalance: z.number(),
  currentBalance: z.number().optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  icon: z.string(),
  isActive: z.boolean(),
  displayOrder: z.number().int().nonnegative(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

// Create wallet schema
export const createWalletSchema = z.object({
  name: z.string().min(1).max(100),
  type: walletTypeSchema,
  currency: z.string().length(3).default('USD'),
  initialBalance: z.number().default(0),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  icon: z.string(),
});

// Update wallet schema
export const updateWalletSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  type: walletTypeSchema.optional(),
  currency: z.string().length(3).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  icon: z.string().optional(),
  isActive: z.boolean().optional(),
  displayOrder: z.number().int().nonnegative().optional(),
});

// Reorder wallets schema
export const reorderWalletsSchema = z.object({
  walletIds: z.array(z.string().uuid()).min(1),
});

// Type inference
export type WalletType = z.infer<typeof walletTypeSchema>;
export type Wallet = z.infer<typeof walletSchema>;
export type CreateWallet = z.infer<typeof createWalletSchema>;
export type UpdateWallet = z.infer<typeof updateWalletSchema>;
export type ReorderWallets = z.infer<typeof reorderWalletsSchema>;

// API Response types
export type WalletResponse = {
  wallet: Wallet;
};

export type WalletListResponse = {
  wallets: Wallet[];
};

export type WalletBalanceResponse = {
  walletId: string;
  initialBalance: number;
  currentBalance: number;
  currency: string;
};
