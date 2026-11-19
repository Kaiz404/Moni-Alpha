import type { MinorAmount } from '@repo/types';
import { describe, expect, it } from 'vitest';

import { budgetsFromSpending, planCategoryBudget, planCategoryBudgets, type BudgetRow } from '../budgets';
import { applyToTables } from '../memory';

const NOW = '2026-10-14T03:00:00.000Z';
const minor = (value: number) => value as MinorAmount;

function context() {
  let next = 0;
  return { userId: 'user-1', now: NOW, newId: () => `new-${(next += 1)}` };
}

const row = (over: Partial<BudgetRow>): BudgetRow => ({
  id: 'b-food',
  user_id: 'user-1',
  category_id: 'food',
  currency: 'MYR',
  amount: 450,
  period: 'monthly',
  deleted: false,
  created_at: '2026-09-01T00:00:00.000Z',
  updated_at: '2026-09-01T00:00:00.000Z',
  ...over,
});

describe('planCategoryBudget', () => {
  it('changes a live budget in place', () => {
    expect(planCategoryBudget([row({})], { categoryId: 'food', currency: 'MYR', amountMinor: minor(12000) }, context())).toEqual({
      kind: 'writes',
      writes: {
        insert: [],
        patch: [{ table: 'category_budgets', id: 'b-food', patch: { amount: '120.00', updated_at: NOW } }],
        softDelete: [],
      },
      result: null,
    });
  });

  it('creates a budget for a category that has none', () => {
    const plan = planCategoryBudget([row({})], { categoryId: 'transport', currency: 'MYR', amountMinor: minor(12000) }, context());
    expect(plan).toEqual({
      kind: 'writes',
      writes: {
        insert: [
          {
            table: 'category_budgets',
            row: {
              id: 'new-1',
              user_id: 'user-1',
              category_id: 'transport',
              currency: 'MYR',
              amount: '120.00',
              period: 'monthly',
              deleted: false,
            },
          },
        ],
        patch: [],
        softDelete: [],
      },
      result: null,
    });
  });

  it('revives the soft-deleted row the table key still holds', () => {
    const plan = planCategoryBudget([row({ deleted: true })], { categoryId: 'food', currency: 'MYR', amountMinor: minor(30000) }, context());
    expect(plan.kind === 'writes' && plan.writes.insert).toEqual([
      {
        table: 'category_budgets',
        row: {
          id: 'b-food',
          user_id: 'user-1',
          category_id: 'food',
          currency: 'MYR',
          amount: '300.00',
          period: 'monthly',
          deleted: false,
          created_at: '2026-09-01T00:00:00.000Z',
          updated_at: NOW,
        },
      },
    ]);
  });

  it('clears a budget softly, and clearing none writes nothing', () => {
    expect(planCategoryBudget([row({})], { categoryId: 'food', currency: 'MYR', amountMinor: null }, context())).toEqual({
      kind: 'writes',
      writes: { insert: [], patch: [], softDelete: [{ table: 'category_budgets', id: 'b-food', at: NOW }] },
      result: null,
    });
    expect(planCategoryBudget([row({ deleted: true })], { categoryId: 'food', currency: 'MYR', amountMinor: minor(0) }, context())).toEqual({
      kind: 'writes',
      writes: { insert: [], patch: [], softDelete: [] },
      result: null,
    });
  });

  it('keeps another currency’s budget for the same category apart', () => {
    const plan = planCategoryBudget([row({ currency: 'SGD' })], { categoryId: 'food', currency: 'MYR', amountMinor: minor(5000) }, context());
    expect(plan.kind === 'writes' && plan.writes.insert.map((insert) => insert.row.id)).toEqual(['new-1']);
  });

  it('refuses a negative amount', () => {
    expect(planCategoryBudget([], { categoryId: 'food', currency: 'MYR', amountMinor: minor(-100) }, context())).toEqual({
      kind: 'error',
      message: 'A budget is a positive amount',
    });
  });

  it('applies over the stored rows: one change, one new row, one cleared', () => {
    const rows = [row({}), row({ id: 'b-gifts', category_id: 'gifts', amount: '80.00' })];
    const plan = planCategoryBudgets(
      rows,
      [
        { categoryId: 'food', currency: 'MYR', amountMinor: minor(50000) },
        { categoryId: 'transport', currency: 'MYR', amountMinor: minor(12000) },
        { categoryId: 'gifts', currency: 'MYR', amountMinor: null },
      ],
      context(),
    );
    if (plan.kind !== 'writes') throw new Error(plan.kind);
    const tables = applyToTables({ category_budgets: Object.fromEntries(rows.map((item) => [item.id, item])) }, plan.writes);
    expect(
      Object.values(tables.category_budgets ?? {}).map((item) => [item.category_id, item.amount, item.deleted]),
    ).toEqual([
      ['food', '500.00', false],
      ['gifts', '80.00', true],
      ['transport', '120.00', false],
    ]);
  });
});

describe('budgetsFromSpending', () => {
  it('rounds each category’s spend up to a whole ringgit and skips the ones that spent nothing', () => {
    expect(
      budgetsFromSpending(
        new Map([
          ['food', minor(34980)],
          ['transport', minor(12000)],
          ['gifts', minor(0)],
        ]),
        'MYR',
      ),
    ).toEqual([
      { categoryId: 'food', currency: 'MYR', amountMinor: 35000 },
      { categoryId: 'transport', currency: 'MYR', amountMinor: 12000 },
    ]);
  });
});
