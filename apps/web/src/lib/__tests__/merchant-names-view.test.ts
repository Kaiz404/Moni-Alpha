import type { FinanceTransaction, MerchantEntry } from '@repo/core';
import { describe, expect, it } from 'vitest';
import { merchantPage, merchantTable } from '../merchant-names-view';

const pay = (merchant: string | null, day: number, source = 'notification', walletId = 'maybank') =>
  ({
    walletId,
    merchant,
    categoryId: 'food',
    transactionDate: `2026-10-${String(day).padStart(2, '0')}T04:00:00.000Z`,
    metadata: { source },
  }) as unknown as FinanceTransaction;

const entry = (key: string, count: number, name: string | null = null): MerchantEntry => ({
  key,
  raw: key.toUpperCase(),
  name,
  count,
  wallet: null,
  walletId: null,
  categoryId: null,
  guess: null,
});

describe('merchantTable', () => {
  it('counts each code from alerts and lists its names, skipping rows with no merchant', () => {
    const table = merchantTable(
      [pay('GRAB*FOOD', 1), pay('GRAB*FOOD', 2), pay('GRAB*FOOD', 3, 'manual', 'tng'), pay(null, 4), pay('SHELL 0441', 5)],
      [{ rawKey: 'shell', displayName: 'Shell' }],
      { maybank: 'Maybank', tng: "Touch 'n Go" },
    );
    expect(table.toName.map((row) => [row.key, row.count, row.walletId, row.wallet, row.guess])).toEqual([
      ['grab food', 3, 'maybank', 'Maybank', 'Grab Food'],
    ]);
    expect(table.named.map((row) => [row.key, row.name, row.count])).toEqual([['shell', 'Shell', 1]]);
  });
});

describe('merchantPage', () => {
  const list = {
    toName: [entry('grab food', 14), entry('mbb ct', 6)],
    named: [entry('paynet', 9, 'TNB electricity'), entry('grab', 7, 'Grab')],
  };

  it('shows every code by most payments, with the counts for each filter', () => {
    const page = merchantPage(list, { filter: 'all', query: '', sort: 'payments', page: 1 });
    expect(page.rows.map((row) => row.key)).toEqual(['grab food', 'paynet', 'grab', 'mbb ct']);
    expect(page.counts).toEqual({ all: 4, toName: 2, named: 2 });
    expect([page.first, page.last, page.total, page.pages, page.page]).toEqual([1, 4, 4, 1, 1]);
  });

  it('filters to the named ones, searches codes and names, and sorts by name', () => {
    expect(merchantPage(list, { filter: 'named', query: '', sort: 'name', page: 1 }).rows.map((row) => row.name)).toEqual([
      'Grab',
      'TNB electricity',
    ]);
    const searched = merchantPage(list, { filter: 'all', query: ' grab ', sort: 'payments', page: 1 });
    expect(searched.rows.map((row) => row.key)).toEqual(['grab food', 'grab']);
    expect(searched.counts).toEqual({ all: 2, toName: 1, named: 1 });
  });

  it('pages 25 at a time and clamps a page past the end', () => {
    const many = { toName: Array.from({ length: 30 }, (_, index) => entry(`code ${String.fromCharCode(97 + (index % 26))}${index}`, 40 - index)), named: [] };
    const second = merchantPage(many, { filter: 'all', query: '', sort: 'payments', page: 9 });
    expect([second.page, second.pages, second.first, second.last, second.rows.length]).toEqual([2, 2, 26, 30, 5]);
  });
});
