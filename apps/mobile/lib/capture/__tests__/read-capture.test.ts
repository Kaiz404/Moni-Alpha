import type { CurrencyCode, MinorAmount } from '@repo/types';

import type { ExtractedTransaction } from '@/lib/ai/client/types';
import {
  draftFromExtraction,
  type ReadContext,
} from '@/lib/capture/read-capture';
import type {
  FinanceTransaction,
  FinanceWallet,
} from '@/lib/finance/types';

jest.mock('@/lib/ai/client', () => ({ getAiClient: jest.fn() }));

const capturedAt = new Date(2026, 9, 14, 14, 5);

const wallet = (id: string, name: string): FinanceWallet => ({
  id,
  userId: 'kai',
  name,
  type: 'cash',
  currency: 'MYR' as CurrencyCode,
  initialBalanceMinor: 0 as MinorAmount,
  color: null,
  icon: null,
  cardStyleId: null,
  isActive: true,
  displayOrder: 0,
  balanceConfirmedAt: null,
});

const visit = (walletId: string, day: number): FinanceTransaction => ({
  id: `kopitiam-${day}`,
  userId: 'kai',
  walletId,
  amountMinor: 1050 as MinorAmount,
  currency: 'MYR' as CurrencyCode,
  type: 'expense',
  analysisExcluded: false,
  debtActivityId: null,
  categoryId: 'food',
  transferToWalletId: null,
  linkedTransactionId: null,
  description: null,
  merchant: 'Kopitiam',
  notes: null,
  transactionDate: new Date(2026, 9, day, 9).toISOString(),
  locationLatitude: null,
  locationLongitude: null,
  locationName: null,
  autoAdded: false,
  createdAt: new Date(2026, 9, day, 9).toISOString(),
});

const context: ReadContext = {
  wallets: [wallet('cash', 'Cash'), wallet('maybank', 'Maybank')],
  categories: [
    { id: 'food', name: 'Food & Dining', type: 'expense', isActive: true },
  ],
  history: [visit('cash', 13), visit('cash', 12), visit('maybank', 10)],
  defaultWalletId: 'maybank',
};

const heard: ExtractedTransaction = {
  amount: 9.8,
  type: 'expense',
  currency: 'MYR',
  merchant: 'Kopitiam',
  description: 'kopi and kaya toast',
  walletHint: null,
  categoryHint: null,
  walletId: null,
  transferToWalletHint: null,
  transferToWalletId: null,
  confidence: 0.9,
  reasoning: 'Heard an amount and a shop.',
  occurredAt: null,
};

describe('draft from extraction', () => {
  it('fills the wallet and category from the last visits to the shop', () => {
    expect(
      draftFromExtraction(
        { status: 'ok', extraction: heard },
        context,
        capturedAt,
      ),
    ).toEqual({
      status: 'ok',
      draft: {
        kind: 'expense',
        merchant: 'Kopitiam',
        amountMinor: 980,
        categoryId: 'food',
        walletId: 'cash',
        transactionDate: capturedAt.toISOString(),
        evidence:
          "You didn't say a wallet. Cash paid your last 2 Kopitiam visits.",
      },
    });
  });

  it('keeps a wallet the words named, with the reader as evidence', () => {
    const result = draftFromExtraction(
      { status: 'ok', extraction: { ...heard, walletId: 'maybank' } },
      context,
      capturedAt,
    );

    expect(result.status === 'ok' && result.draft.walletId).toBe('maybank');
    expect(result.status === 'ok' && result.draft.evidence).toBe(
      'Heard an amount and a shop.',
    );
  });

  it('fails with no total, and passes an unavailable reader through', () => {
    expect(
      draftFromExtraction(
        { status: 'ok', extraction: { ...heard, amount: 0 } },
        context,
        capturedAt,
      ),
    ).toEqual({
      status: 'unreadable',
      reason: "Moni couldn't find a total",
    });
    expect(
      draftFromExtraction(
        { status: 'unavailable', reason: 'offline' },
        context,
        capturedAt,
      ),
    ).toEqual({ status: 'unavailable', reason: 'offline' });
  });
});
