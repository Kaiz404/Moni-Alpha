import { createCalendar, walletGroups, type FinanceTransaction, type FinanceWallet } from '@repo/core';
import type { MinorAmount } from '@repo/types';
import { describe, expect, it } from 'vitest';
import { assetsAndOwed, monthChanges, walletsCsv } from '../wallets-view';

const KL = createCalendar('Asia/Kuala_Lumpur');
const m = (value: number) => value as MinorAmount;
const wallet = (id: string, name: string, type: string, currency = 'MYR') => ({ id, name, type, currency }) as FinanceWallet;
const move = (type: FinanceTransaction['type'], walletId: string, amount: number, at: string, transferToWalletId: string | null = null) =>
  ({ type, walletId, transferToWalletId, amountMinor: m(amount), transactionDate: at }) as FinanceTransaction;

const wallets = [wallet('mb', 'Maybank Savings', 'bank'), wallet('card', 'CIMB, Visa', 'credit'), wallet('dbs', 'DBS', 'bank', 'SGD')];
const balances = { mb: m(228180), card: m(-45000), dbs: m(12000) };

describe('monthChanges', () => {
  it('adds this month’s moves to each wallet, transfers both ways, and leaves last month and tomorrow out', () => {
    const now = new Date('2026-10-14T04:00:00.000Z');
    expect(
      monthChanges(
        [
          move('income', 'mb', 500000, '2026-10-01T01:00:00.000Z'),
          move('expense', 'card', 4520, '2026-10-13T12:00:00.000Z'),
          move('transfer', 'mb', 20000, '2026-10-14T02:00:00.000Z', 'card'),
          move('expense', 'mb', 999, '2026-09-30T08:00:00.000Z'),
          move('expense', 'mb', 777, '2026-10-15T08:00:00.000Z'),
        ],
        now,
        KL,
      ),
    ).toEqual({ mb: 480000, card: 15480 });
  });
});

describe('assetsAndOwed', () => {
  it('splits the main currency into what you have and what cards are owed', () => {
    expect(assetsAndOwed(walletGroups(wallets, balances, 'MYR')[0], balances)).toEqual({ assetsMinor: 228180, owedMinor: 45000 });
  });
});

describe('walletsCsv', () => {
  it('writes one row a wallet in list order and quotes a name with a comma', () => {
    expect(walletsCsv(walletGroups(wallets, balances, 'MYR'), balances, { mb: 480000 }, new Set(['mb']))).toBe(
      [
        'Wallet,Kind,Currency name,Currency,Balance,This month',
        'Maybank Savings,Bank · alerts on,Ringgit,MYR,2281.80,4800.00',
        '"CIMB, Visa",Card,Ringgit,MYR,-450.00,0.00',
        'DBS,Bank · Singapore dollars,Singapore dollar,SGD,120.00,0.00',
        '',
      ].join('\n'),
    );
  });

  it('keeps a spreadsheet from running a wallet name as a formula, and a negative balance a number', () => {
    const named = [wallet('a', '=HYPERLINK("x")', 'bank'), wallet('b', '+60 Petty', 'cash'), wallet('c', '@cash', 'cash'), wallet('d', '-Loan', 'credit')];
    const owed = { a: m(100), b: m(0), c: m(0), d: m(-2500) };
    expect(walletsCsv(walletGroups(named, owed, 'MYR'), owed, {}, new Set()).split('\n').slice(1, 5)).toEqual([
      `"'=HYPERLINK(""x"")",Bank,Ringgit,MYR,1.00,0.00`,
      "'+60 Petty,In your pocket,Ringgit,MYR,0.00,0.00",
      "'@cash,In your pocket,Ringgit,MYR,0.00,0.00",
      "'-Loan,Card,Ringgit,MYR,-25.00,0.00",
    ]);
  });
});
