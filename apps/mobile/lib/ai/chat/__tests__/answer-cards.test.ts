import type { MinorAmount } from '@repo/types';

import { pickAnswerCard, type AnswerSnapshot } from '@/lib/ai/chat/answer-cards';

const snapshot: AnswerSnapshot = {
  currency: 'MYR',
  categories: [
    { id: 'food', name: 'Food & Dining', icon: null, color: null, spent: 34980, budget: 45000 },
    { id: 'transport', name: 'Transport', icon: 'car', color: '#9FC4E8', spent: 14000, budget: 12000 },
  ],
  month: {
    spent: 111620,
    budget: 180000,
    left: 44300,
    daysLeft: 18,
    perDay: 2461,
    owed: [{ name: 'Mei', amountMinor: 4000 as MinorAmount }],
  },
  bills: [
    { seriesKey: 'netflix', name: 'Netflix', amount: 5490, dueDate: '2026-10-15', walletName: 'Maybank Savings' },
    { seriesKey: 'unifi', name: 'Unifi', amount: 12900, dueDate: '2026-10-20', walletName: null },
  ],
  waiting: ['p1', 'p2'],
};

describe('pickAnswerCard', () => {
  it('fills a category card from the ledger snapshot', () => {
    expect(pickAnswerCard('How much on Transport this month', snapshot)).toEqual({
      kind: 'category_spend',
      categoryId: 'transport',
      spent: 14000,
      budget: 12000,
    });
  });

  it('reads a category by its first word', () => {
    expect(pickAnswerCard('how much did I spend on food?', snapshot)).toEqual({
      kind: 'category_spend',
      categoryId: 'food',
      spent: 34980,
      budget: 45000,
    });
  });

  it('answers a named bill with the bills still ahead of it, then the next bill for a general one', () => {
    expect(pickAnswerCard('When does Unifi go out?', snapshot)).toEqual({
      kind: 'bill_due',
      seriesKey: 'unifi',
      name: 'Unifi',
      amount: 12900,
      dueDate: '2026-10-20',
      walletName: null,
      ahead: [{ name: 'Unifi', amount: 12900, dueDate: '2026-10-20' }],
      owed: [{ name: 'Mei', amountMinor: 4000 }],
      perDay: 2461,
    });
    expect(pickAnswerCard('Any bills due soon?', snapshot)).toMatchObject({
      kind: 'bill_due',
      seriesKey: 'netflix',
      walletName: 'Maybank Savings',
      ahead: [
        { name: 'Netflix', amount: 5490, dueDate: '2026-10-15' },
        { name: 'Unifi', amount: 12900, dueDate: '2026-10-20' },
      ],
    });
  });

  it('lists the waiting captures when asked to show them', () => {
    expect(pickAnswerCard('Show my 2 captures', snapshot)).toEqual({
      kind: 'captures',
      proposalIds: ['p1', 'p2'],
    });
  });

  it('shows what is left for a budget question and nothing for small talk', () => {
    expect(pickAnswerCard('How much can I spend today?', snapshot)).toEqual({
      kind: 'budget_progress',
      spent: 111620,
      budget: 180000,
      left: 44300,
      daysLeft: 18,
      perDay: 2461,
    });
    expect(pickAnswerCard('What can you do?', snapshot)).toBeNull();
  });
});
