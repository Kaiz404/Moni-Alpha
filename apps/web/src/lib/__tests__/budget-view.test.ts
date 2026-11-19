import type { MoneyMonth, SpendByMonth } from '@repo/core';
import type { MinorAmount } from '@repo/types';
import { describe, expect, it } from 'vitest';
import { budgetTable, chartTop, parseAmountDraft, parseBudgetDraft } from '../budget-view';

const m = (value: number) => value as MinorAmount;

const month = {
  currency: 'MYR',
  spentMinor: m(51000),
  budgetMinor: m(180000),
  budgeted: [
    { categoryId: 'food', name: 'Food & Dining', icon: 'silverware-fork-knife', color: '#FB7F77', spentMinor: m(34980), budgetMinor: m(45000) },
    { categoryId: 'transport', name: 'Transport', icon: 'car', color: '#7CBDF8', spentMinor: m(14000), budgetMinor: m(12000) },
  ],
  unbudgeted: [{ categoryId: 'gifts', name: 'Gifts', icon: 'gift-outline', color: '#E77BE7', spentMinor: m(4500), budgetMinor: null }],
} as unknown as MoneyMonth;

const history: SpendByMonth = {
  months: ['2026-07', '2026-08', '2026-09', '2026-10'],
  byCategory: new Map([
    ['food', [m(30000), m(36000), m(42000), m(34980)]],
    ['transport', [m(0), m(9000), m(6000), m(14000)]],
  ]),
  totals: [m(30000), m(45000), m(48000), m(53480)],
  firstMonth: '2026-07',
};

describe('budgetTable', () => {
  it('reads each row against its budget and its last three months', () => {
    const table = budgetTable(month, history);
    expect(
      table.budgeted.map((row) => [row.name, row.note.label, row.note.tone, row.lastMonthMinor, row.averageMinor]),
    ).toEqual([
      ['Food & Dining', 'RM100 left', 'near', 42000, 36000],
      ['Transport', 'RM20 over', 'over', 6000, 5000],
    ]);
    expect(table.unbudgeted.map((row) => [row.name, row.note.label, row.lastMonthMinor, row.averageMinor, row.months])).toEqual([
      ['Gifts', 'RM45.00 spent', 0, 0, [0, 0, 0, 0]],
    ]);
    expect([table.budgetMinor, table.inCategoriesMinor, table.spentMinor, table.lastMonthMinor, table.averageMinor]).toEqual([
      180000, 57000, 51000, 48000, 41000,
    ]);
  });

  it('lists the quiet categories too when setting budgets from scratch', () => {
    const quiet = { id: 'health', name: 'Health', icon: 'pill', color: '#FC7C91' } as never;
    expect(budgetTable(month, history, [quiet]).unbudgeted.map((row) => [row.name, row.note.label])).toEqual([
      ['Gifts', 'RM45.00 spent'],
      ['Health', 'Nothing yet'],
    ]);
  });
});

describe('parseBudgetDraft', () => {
  it('reads whole ringgit and clears on empty or zero', () => {
    expect(['120', 'RM1,200', ' 99.90 ', '', '0', 'abc', '1.2.3'].map(parseBudgetDraft)).toEqual([
      12000,
      120000,
      9900,
      null,
      null,
      undefined,
      undefined,
    ]);
  });
});

describe('parseAmountDraft', () => {
  it('keeps cents and refuses nothing or too many decimals', () => {
    expect(['150', 'RM1,200.5', '40.00', '0', '', '1.234'].map(parseAmountDraft)).toEqual([15000, 120050, 4000, undefined, undefined, undefined]);
  });
});

describe('chartTop', () => {
  it('rounds above the tallest bar or the budget', () => {
    expect([chartTop([14000, 9000], 12000), chartTop([0], null), chartTop([45000], 50000)]).toEqual([18000, 10000, 60000]);
  });
});
