import { describe, expect, it } from 'vitest';

import { compactWalletName, compactWalletNames, isAwaitingReview, transactionRow } from '../transaction-row';
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

  it('keeps a transfer’s category glyph, still on the Sand bubble', () => {
    expect(
      transactionRow(row({ type: 'transfer', merchant: null, description: null, transferToWalletId: 'tng' }), lookups),
    ).toEqual({
      id: 't',
      title: 'Transfer',
      date: '2026-10-14T00:05:00.000Z',
      amountMinor: 1320,
      currency: 'MYR',
      icon: 'silverware-fork-knife',
      color: null,
      kind: 'transfer',
      category: null,
      wallet: 'Maybank',
      toWallet: "Touch 'n Go",
      autoAdded: false,
    });
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

  const names = (...list: string[]) => compactWalletNames(list.map((name, index) => ({ id: String(index), name })));

  it.each([
    [['Maybank Savings', "Touch 'n Go eWallet", 'Cash'], ['Maybank', "Touch 'n Go", 'Cash']],
    [['Maybank Savings', 'Maybank Current', 'Cash'], ['Maybank Savings', 'Maybank Current', 'Cash']],
    [['Maybank Savings', 'Maybank'], ['Maybank Savings', 'Maybank']],
    [['MAYBANK SAVINGS', 'maybank current'], ['MAYBANK SAVINGS', 'maybank current']],
    [['Cash', 'Cash'], ['Cash', 'Cash']],
    [[], []],
  ])('reads %j as %j', (full, compact) => {
    expect(names(...full)).toEqual(Object.fromEntries(compact.map((name, i) => [String(i), name])));
  });
});

describe('compactWalletName', () => {
  it.each([
    ['Maybank Savings', 'Maybank'],
    ["Touch 'n Go eWallet", "Touch 'n Go"],
    ['Cash', 'Cash'],
    ['Wise USD', 'Wise USD'],
    ['CIMB Current', 'CIMB'],
    ['CIMB Current Account', 'CIMB'],
    ['Public Bank Saving Acct', 'Public Bank'],
    ['MAYBANK SAVINGS', 'MAYBANK'],
    ['GrabPay e-wallet', 'GrabPay'],
    ['Boost E-Wallet', 'Boost'],
    ['ShopeePay E Wallet', 'ShopeePay'],
    ['BigPay Wallet', 'BigPay'],
    ['Maybank - Savings', 'Maybank'],
    ['  RHB Savings  ', 'RHB'],
    ['Savings', 'Savings'],
    ['Wallet', 'Wallet'],
    ['Savings Account', 'Savings'],
    ['- Savings', '- Savings'],
    ['Mywallet', 'Mywallet'],
    ['Savings Goal', 'Savings Goal'],
    ['Current Fund', 'Current Fund'],
  ])('reads %s as %s', (full, compact) => {
    expect(compactWalletName(full)).toBe(compact);
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
        { status: 'rejected' as const, snoozedUntil: null },
      ].map((proposal) => isAwaitingReview(proposal, now)),
    ).toEqual([true, true, false, false, false]);
  });
});
