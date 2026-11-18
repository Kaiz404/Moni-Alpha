import { decimalToMinor, type MinorAmount } from '@repo/types';

import type { FactsTransaction } from '../recurring';

export const BANK = 'bank-myr';

const pad = (value: number) => String(value).padStart(2, '0');

/** 9 am Kuala Lumpur time on a day of 2026. */
export function on(month: number, day: number): string {
  return `2026-${pad(month)}-${pad(day)}T09:00:00+08:00`;
}

export function tx(
  date: string,
  type: FactsTransaction['type'],
  amount: string | number,
  merchant: string | null,
  over: Partial<FactsTransaction> = {},
): FactsTransaction {
  return {
    walletId: BANK,
    transferToWalletId: null,
    amountMinor: (typeof amount === 'number' ? amount : decimalToMinor(amount)) as MinorAmount,
    currency: 'MYR',
    type,
    analysisExcluded: false,
    debtActivityId: null,
    categoryId: null,
    merchant,
    transactionDate: new Date(date).toISOString(),
    ...over,
  } as FactsTransaction;
}
