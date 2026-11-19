import { describe, expect, it } from 'vitest';

import { createCalendar } from '../../calendar';
import type { AnswerSnapshot } from '../answer-cards';
import { pickViewAnswerCard, spendByWeek } from '../week-card';

const calendar = createCalendar('Asia/Kuala_Lumpur');
const spend = (at: string, amountMinor: number, categoryId: string | null = 'food', extra = {}) => ({
  transactionDate: at,
  amountMinor,
  categoryId,
  currency: 'MYR',
  type: 'expense' as const,
  analysisExcluded: false,
  debtActivityId: null,
  ...extra,
});

describe('spendByWeek', () => {
  const transactions = [
    spend('2026-09-30T17:30:00Z', 1500),
    spend('2026-10-07T15:59:00Z', 2740),
    spend('2026-10-07T16:01:00Z', 1000),
    spend('2026-10-14T04:35:00Z', 4590),
    spend('2026-10-14T04:36:00Z', 700, 'transport'),
    spend('2026-10-13T04:00:00Z', 900, 'food', { currency: 'SGD' }),
    spend('2026-10-12T04:00:00Z', 800, 'food', { debtActivityId: 'd1' }),
    spend('2026-10-15T04:00:00Z', 9999),
  ];

  it('adds one category by week of the month so far, in the user zone, against the week of even pace', () => {
    expect(spendByWeek({ transactions, currency: 'MYR', categoryId: 'food', budgetMinor: 45000, today: '2026-10-14', calendar })).toEqual({
      weeks: [
        { label: '1–7 Oct', from: '2026-10-01', to: '2026-10-07', spentMinor: 4240 },
        { label: '8–14 Oct', from: '2026-10-08', to: '2026-10-14', spentMinor: 5590 },
      ],
      paceMinor: 10100,
    });
  });

  it('cuts the last week at today and leaves the pace out without a budget', () => {
    expect(spendByWeek({ transactions, currency: 'MYR', categoryId: null, budgetMinor: null, today: '2026-10-09', calendar })).toEqual({
      weeks: [
        { label: '1–7 Oct', from: '2026-10-01', to: '2026-10-07', spentMinor: 4240 },
        { label: '8–9 Oct', from: '2026-10-08', to: '2026-10-09', spentMinor: 1000 },
      ],
      paceMinor: null,
    });
  });
});

describe('pickViewAnswerCard', () => {
  const snapshot: AnswerSnapshot = {
    currency: 'MYR',
    categories: [
      { id: 'food', name: 'Food & Dining', icon: null, color: null, spent: 34980, budget: 45000 },
      { id: 'transport', name: 'Transport', icon: null, color: null, spent: 13550, budget: 12000 },
    ],
    month: { spent: 111620, budget: 180000, left: 44300, daysLeft: 18, perDay: 2461, owed: [] },
    bills: [],
    waiting: [],
  };

  it("answers a spending question with the view's category when the question names none", () => {
    expect(pickViewAnswerCard('Why so high this month?', snapshot, 'food')).toEqual({
      kind: 'category_spend',
      categoryId: 'food',
      spent: 34980,
      budget: 45000,
    });
    expect(pickViewAnswerCard('how much is left', snapshot, 'transport')).toEqual({
      kind: 'category_spend',
      categoryId: 'transport',
      spent: 13550,
      budget: 12000,
    });
  });

  it("keeps the question's own card, and the plain answer for other questions", () => {
    expect(pickViewAnswerCard('How is transport doing?', snapshot, 'food')).toEqual({
      kind: 'category_spend',
      categoryId: 'transport',
      spent: 13550,
      budget: 12000,
    });
    expect(pickViewAnswerCard('how much is left', snapshot, null)).toEqual({
      kind: 'budget_progress',
      spent: 111620,
      budget: 180000,
      left: 44300,
      daysLeft: 18,
      perDay: 2461,
    });
    expect(pickViewAnswerCard('what can you do', snapshot, 'food')).toBeNull();
  });
});
