import { walletEffect } from '@repo/core';
import type { FinanceTransaction } from '@/lib/finance/types';

/** A wallet's movement over these rows, as its real balance computes it. */
export function walletBalanceForTest(rows: readonly FinanceTransaction[], walletId: string): number {
  return rows.reduce((sum, row) => sum + Number(walletEffect(row, walletId)), 0);
}
