import type { CurrencyCode, MinorAmount } from '@repo/types';

import type { FinanceTransaction } from '@/lib/finance/types';
import { exportFileName, transactionsCsv } from '../export-csv';

function transaction(overrides: Partial<FinanceTransaction>): FinanceTransaction {
  return {
    id: 't',
    userId: 'u',
    walletId: 'maybank',
    amountMinor: 0 as MinorAmount,
    currency: 'MYR' as CurrencyCode,
    type: 'expense',
    analysisExcluded: false,
    debtActivityId: null,
    categoryId: null,
    transferToWalletId: null,
    linkedTransactionId: null,
    description: null,
    merchant: null,
    notes: null,
    transactionDate: '2026-10-14T06:00:00.000Z',
    locationLatitude: null,
    locationLongitude: null,
    locationName: null,
    autoAdded: false,
    balanceCorrection: false,
    createdAt: '2026-10-14T06:00:00.000Z',
    ...overrides,
  };
}

describe('transactionsCsv', () => {
  it('writes one row per transaction, oldest first, quoting commas and quotes', () => {
    const csv = transactionsCsv(
      [
        transaction({
          id: 'b',
          amountMinor: 4590 as MinorAmount,
          merchant: 'Grab, KL',
          categoryId: 'food',
          notes: 'said "lunch"',
        }),
        transaction({
          id: 'a',
          type: 'transfer',
          amountMinor: 2000 as MinorAmount,
          walletId: 'maybank',
          transferToWalletId: 'tng',
          description: 'Top up',
          transactionDate: '2026-10-13T06:00:00.000Z',
        }),
      ],
      { maybank: 'Maybank', tng: "Touch 'n Go" },
      { food: 'Food & Dining' },
    );

    expect(csv).toBe(
      [
        'Date,Type,Amount,Currency,Merchant,Category,Wallet,To wallet,Note',
        "2026-10-13,transfer,20.00,MYR,Top up,,Maybank,Touch 'n Go,",
        '2026-10-14,expense,45.90,MYR,"Grab, KL",Food & Dining,Maybank,,"said ""lunch"""',
        '',
      ].join('\n'),
    );
  });

  it('names the file for the local day', () => {
    expect(exportFileName(new Date(2026, 9, 14, 14, 6))).toBe('moni-2026-10-14.csv');
  });
});
