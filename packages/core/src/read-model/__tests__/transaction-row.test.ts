import { describe, expect, it } from 'vitest';

import { compactWalletNames, isAwaitingReview, transactionRow } from '../transaction-row';
import type { FinanceTransaction } from '../types';

const lookups = {
  categoriesById: { food: { name: 'Food & Dining', icon: 'silverware-fork-knife', color: '#FF7F70' } },
  walletNames: { mb: 'Maybank', tng: "Touch 'n Go" },
};
const row = (over: Partial<FinanceTransaction>) =>
  ({
    id: 't',
    walletId: 'mb',
    type: 'expense',
    amountMinor: 1320,
    currency: 'MYR',
    merchant: 'Mamak Ali',
    description: null,
    categoryId: 'food',
    transferToWalletId: null,
    transactionDate: '2026-10-14T00:05:00.000Z',
    autoAdded: false,
    balanceCorrection: false,
    ...over,
  }) as FinanceTransaction;

describe('transactionRow', () => {
  it('reads an expense under its merchant, category and compact wallet', () => {
    expect(transactionRow(row({}), lookups)).toMatchObject({
      title: 'Mamak Ali',
      icon: 'silverware-fork-knife',
      color: '#FF7F70',
      category: 'Food & Dining',
      wallet: 'Maybank',
      toWallet: null,
    });
  });

  it('reads a transfer by its description, on a Sand bubble, with both wallets', () => {
    expect(
      transactionRow(row({ type: 'transfer', merchant: null, categoryId: null, description: "Touch 'n Go reload", transferToWalletId: 'tng', autoAdded: true }), lookups),
    ).toMatchObject({ title: "Touch 'n Go reload", icon: 'swap-horizontal', color: null, toWallet: "Touch 'n Go", autoAdded: true });
  });

  it('reads a balance correction as one, never Auto', () => {
    expect(transactionRow(row({ balanceCorrection: true, categoryId: null, merchant: null }), lookups)).toMatchObject({
      title: 'Balance correction',
      category: 'Not in budgets',
      icon: 'scale-balance',
    });
  });
});

describe('compactWalletNames', () => {
  it('drops the account word unless two wallets would then read the same', () => {
    expect(
      compactWalletNames([
        { id: 'a', name: 'Maybank Savings' },
        { id: 'b', name: "Touch 'n Go eWallet" },
        { id: 'c', name: 'CIMB Savings' },
        { id: 'd', name: 'CIMB Current' },
      ]),
    ).toEqual({ a: 'Maybank', b: "Touch 'n Go", c: 'CIMB Savings', d: 'CIMB Current' });
  });
});

describe('isAwaitingReview', () => {
  const now = new Date('2026-10-14T05:00:00.000Z');
  it('waits while pending or once Later runs out', () => {
    expect(
      [
        { status: 'pending' as const, snoozedUntil: null },
        { status: 'later' as const, snoozedUntil: '2026-10-14T04:00:00.000Z' },
        { status: 'later' as const, snoozedUntil: '2026-10-15T04:00:00.000Z' },
        { status: 'approved' as const, snoozedUntil: null },
      ].map((proposal) => isAwaitingReview(proposal, now)),
    ).toEqual([true, true, false, false]);
  });
});
