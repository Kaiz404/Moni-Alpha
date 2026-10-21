import { pickAnswerCard, type AnswerSnapshot } from '@/lib/ai/chat/answer-cards';

const snapshot: AnswerSnapshot = {
  currency: 'MYR',
  categories: [
    { id: 'food', name: 'Food & Dining', spent: 34980, budget: 45000 },
    { id: 'transport', name: 'Transport', spent: 14000, budget: 12000 },
  ],
  month: { spent: 111620, budget: 180000, left: 44300, daysLeft: 18, perDay: 2461 },
  bills: [
    { seriesKey: 'netflix', name: 'Netflix', amount: 5490, dueDate: '2026-10-15' },
    { seriesKey: 'unifi', name: 'Unifi', amount: 12900, dueDate: '2026-10-20' },
  ],
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

  it('answers a named bill, then the next bill for a general one', () => {
    expect(pickAnswerCard('When does Unifi go out?', snapshot)).toEqual({
      kind: 'bill_due',
      seriesKey: 'unifi',
      name: 'Unifi',
      amount: 12900,
      dueDate: '2026-10-20',
    });
    expect(pickAnswerCard('Any bills due soon?', snapshot)).toMatchObject({
      kind: 'bill_due',
      seriesKey: 'netflix',
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
