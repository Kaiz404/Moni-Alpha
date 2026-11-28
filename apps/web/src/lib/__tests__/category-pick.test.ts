import type { FinanceCategory, FinanceProjection, FinanceTransaction } from '@repo/core';
import { describe, expect, it } from 'vitest';

import { categoryChoices, suggestedCategories } from '../category-pick';

const category = (id: string, name: string, type: 'expense' | 'income' | null, displayOrder: number, userId: string | null = null, isActive = true): FinanceCategory => ({
  id,
  userId,
  name,
  icon: null,
  type,
  color: null,
  isActive,
  displayOrder,
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-01T00:00:00.000Z',
});

const filed = (merchant: string, categoryId: string) =>
  ({ type: 'expense', merchant, categoryId, analysisExcluded: false, debtActivityId: null }) as unknown as FinanceTransaction;

const ledger = (transactions: FinanceTransaction[] = []) => ({
  userId: 'me',
  transactions,
  projection: {
    categoriesById: Object.fromEntries(
      [
        category('food', 'Food & Dining', 'expense', 2),
        category('travel', 'Travel', 'expense', 1),
        category('salary', 'Salary', 'income', 1),
        category('pets', 'Pets', 'expense', 101, 'me'),
        category('old', 'Old', 'expense', 102, 'me', false),
        category('theirs', 'Theirs', 'expense', 1, 'someone-else'),
      ].map((each) => [each.id, each]),
    ),
  } as unknown as FinanceProjection,
});

describe('category picks', () => {
  it('offers the active categories of the pick’s type that the user sees, in their order', () => {
    expect(categoryChoices(ledger(), 'expense').map((each) => each.id)).toEqual(['travel', 'food', 'pets']);
    expect(categoryChoices(ledger(), 'income').map((each) => each.id)).toEqual(['salary']);
  });

  it('suggests the user’s own filing of the merchant first, then what the merchant gives away', () => {
    const clues = { type: 'expense', merchant: 'Starbucks KLCC', text: null, sourceApp: null, categoryHint: null };
    expect(suggestedCategories(ledger([filed('Starbucks KLCC', 'pets')]), clues)).toEqual(['pets', 'food']);
    expect(suggestedCategories(ledger(), clues)).toEqual(['food']);
    expect(suggestedCategories(ledger([filed('Starbucks KLCC', 'theirs')]), clues)).toEqual(['food']);
  });
});
