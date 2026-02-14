import type { TransactionListParams } from '@repo/types';

export const queryKeys = {
  overview: ['analytics', 'overview'] as const,
  transactions: (params?: Partial<TransactionListParams>) =>
    ['transactions', params ?? {}] as const,
  wallets: ['wallets'] as const,
  categories: ['categories'] as const,
};
