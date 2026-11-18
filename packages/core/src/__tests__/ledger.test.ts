import type { MinorAmount } from '@repo/types';
import { describe, expect, it } from 'vitest';

import {
  countsAsCashFlow,
  countsAsIncome,
  countsAsSpending,
  debtBalance,
  debtState,
  debtTotals,
  isFiled,
  debtStatus,
  touchesWallet,
  walletEffect,
  type LedgerDebtActivity,
} from '../ledger';

const rm = (ringgit: number) => Math.round(ringgit * 100) as MinorAmount;

const row = (
  type: 'income' | 'expense' | 'transfer',
  extra: {
    analysisExcluded?: boolean;
    debtActivityId?: string | null;
    categoryId?: string | null;
  } = {},
) => ({
  type,
  analysisExcluded: false,
  debtActivityId: null,
  categoryId: 'food',
  walletId: 'cash',
  transferToWalletId: type === 'transfer' ? 'bank' : null,
  amountMinor: rm(25),
  ...extra,
});

describe('what a transaction counts as', () => {
  const ledger = {
    lunch: row('expense'),
    salary: row('income'),
    'move to bank': row('transfer'),
    'balance fix down': row('expense', { analysisExcluded: true }),
    'balance fix up': row('income', { analysisExcluded: true }),
    'repaid Mei': row('expense', { debtActivityId: 'activity-1' }),
    'lent to Mei': row('expense', { debtActivityId: 'activity-2' }),
    'Mei paid back': row('income', { debtActivityId: 'activity-3' }),
    'uncategorised lunch': row('expense', { categoryId: null }),
  };

  it.each([
    ['lunch', true, false, true, true],
    ['salary', false, true, true, true],
    ['move to bank', false, false, false, true],
    ['balance fix down', false, false, false, false],
    ['balance fix up', false, false, false, false],
    ['repaid Mei', false, false, false, false],
    ['lent to Mei', false, false, false, false],
    ['Mei paid back', false, false, false, false],
    ['uncategorised lunch', true, false, true, false],
  ] as const)(
    '%s: spending %s, income %s, cash flow %s, filed %s',
    (name, spending, income, flow, filed) => {
      const transaction = ledger[name];
      expect([
        countsAsSpending(transaction),
        countsAsIncome(transaction),
        countsAsCashFlow(transaction),
        isFiled(transaction),
      ]).toEqual([spending, income, flow, filed]);
    },
  );
});

describe('walletEffect', () => {
  it('takes an expense out, puts income in, and moves a transfer between its two ends', () => {
    expect(walletEffect(row('expense'), 'cash')).toBe(-2500);
    expect(walletEffect(row('income'), 'cash')).toBe(2500);
    expect(walletEffect(row('transfer'), 'cash')).toBe(-2500);
    expect(walletEffect(row('transfer'), 'bank')).toBe(2500);
    expect(walletEffect(row('expense'), 'bank')).toBe(0);
  });

  it('counts a balance fix and debt cash against the wallet, since the money did move', () => {
    expect(walletEffect(row('expense', { analysisExcluded: true }), 'cash')).toBe(-2500);
    expect(walletEffect(row('income', { debtActivityId: 'activity-3' }), 'cash')).toBe(2500);
  });

  it('knows which wallets a row touches', () => {
    expect(['cash', 'bank', 'card'].map((id) => touchesWallet(row('transfer'), id))).toEqual([
      true,
      true,
      false,
    ]);
  });
});

describe('a debt', () => {
  const lent: LedgerDebtActivity[] = [
    { kind: 'principal', amountMinor: rm(100) },
    { kind: 'principal', amountMinor: rm(20) },
    { kind: 'repayment', amountMinor: rm(45.5) },
  ];

  it('owes its principal less repayments and write-offs', () => {
    expect(debtTotals(lent)).toEqual({
      principalMinor: 12000,
      repaidMinor: 4550,
      writtenOffMinor: 0,
      balanceMinor: 7450,
    });
    expect(debtBalance([...lent, { kind: 'write_off', amountMinor: rm(10) }])).toBe(6450);
  });

  it('is open, due soon, then overdue as its due date nears and passes', () => {
    expect(debtState(lent, '2026-10-30', '2026-10-14')).toBe('open');
    expect(debtState(lent, '2026-10-21', '2026-10-14')).toBe('due_soon');
    expect(debtState(lent, '2026-10-14', '2026-10-14')).toBe('due_soon');
    expect(debtState(lent, '2026-10-13', '2026-10-14')).toBe('overdue');
    expect(debtState(lent, null, '2026-10-14')).toBe('open');
  });

  it('is settled when paid in full, and written off when the rest was let go', () => {
    const paid = [...lent, { kind: 'repayment' as const, amountMinor: rm(74.5) }];
    const forgiven = [...lent, { kind: 'write_off' as const, amountMinor: rm(74.5) }];
    expect(debtState(paid, '2026-10-01', '2026-10-14')).toBe('settled');
    expect(debtState(forgiven, '2026-10-01', '2026-10-14')).toBe('written_off');
    expect([debtStatus(lent), debtStatus(paid), debtStatus(forgiven)]).toEqual([
      'open',
      'settled',
      'written_off',
    ]);
  });
});
