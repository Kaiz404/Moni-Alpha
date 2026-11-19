import { describe, expect, it } from 'vitest';

import { createCalendar } from '../../calendar';
import { pickAnswerCard } from '../answer-cards';
import { buildAnswerSnapshot, type AnswerSnapshotInput } from '../answer-snapshot';
import { MYR, budget, byId, category, spend } from './chat-rows';

const KL = createCalendar('Asia/Kuala_Lumpur');
const NOW = new Date('2026-10-14T14:00:00+08:00');

const netflix = (month: number) =>
  spend('me', [month, 15], 54.9, { merchant: 'Netflix', categoryId: 'fun' });

const input: AnswerSnapshotInput = {
  userId: 'me',
  transactions: [
    spend('me', [10, 3], 30, { categoryId: 'food' }),
    spend('me', [10, 9], 12, { categoryId: 'food' }),
    spend('me', [10, 10], 25, { categoryId: 'fun' }),
    netflix(7),
    netflix(8),
    netflix(9),
  ],
  categoriesById: byId([category('food', 'Food', null), category('fun', 'Fun', 'me')]),
  budgetsById: byId([budget('me', 'food', 300)]),
  monthlyBudget: '1000',
  overrides: [],
  debts: [],
  currency: MYR,
  waiting: ['p2', 'p1'],
  walletsById: { maybank: { name: 'Maybank' } },
  now: NOW,
  calendar: KL,
};

describe('buildAnswerSnapshot', () => {
  const snapshot = buildAnswerSnapshot(input);

  it('reads this month in the main currency, after the bill still due', () => {
    expect(snapshot).toEqual({
      currency: 'MYR',
      categories: [
        { id: 'food', name: 'Food', icon: null, color: null, spent: 4200, budget: 30000 },
        { id: 'fun', name: 'Fun', icon: null, color: null, spent: 2500, budget: null },
      ],
      month: { spent: 6700, budget: 100000, left: 87810, daysLeft: 18, perDay: 4800, owed: [] },
      waiting: ['p2', 'p1'],
      bills: [
        {
          seriesKey: 'MYR|expense|netflix',
          name: 'Netflix',
          amount: 5490,
          dueDate: '2026-10-15',
          walletName: 'Maybank',
        },
      ],
    });
  });

  it('fills the card a question asks for', () => {
    expect(pickAnswerCard('How much can I spend a day?', snapshot)).toEqual({
      kind: 'budget_progress',
      spent: 6700,
      budget: 100000,
      left: 87810,
      daysLeft: 18,
      perDay: 4800,
    });
  });
});
