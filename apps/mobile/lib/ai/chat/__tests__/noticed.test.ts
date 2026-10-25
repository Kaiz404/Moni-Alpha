import type { AnswerSnapshot } from '@/lib/ai/chat/answer-cards';
import { noticedItems } from '@/lib/ai/chat/noticed';

const snapshot: AnswerSnapshot = {
  currency: 'MYR',
  categories: [
    { id: 'food', name: 'Food & Dining', icon: 'silverware-fork-knife', color: '#F1A399', spent: 34980, budget: 45000 },
    { id: 'transport', name: 'Transport', icon: 'car', color: '#9FC4E8', spent: 14000, budget: 12000 },
  ],
  month: { spent: 111620, budget: 180000, left: 44300, daysLeft: 18, perDay: 2400, owed: [] },
  bills: [
    { seriesKey: 'netflix', name: 'Netflix', amount: 5490, dueDate: '2026-10-15', walletName: 'Maybank Savings' },
  ],
  waiting: ['p1', 'p2', 'p3'],
};

describe('noticedItems', () => {
  it('names the overspent category, the waiting captures and the next bill as on V2H-AskMoni', () => {
    const items = noticedItems(snapshot, { count: 3, amount: 11580 }, new Date(2026, 9, 14, 14, 5));
    expect(items).toEqual([
      {
        title: 'Transport is RM20 over',
        meta: 'RM140 of your RM120 budget',
        icon: 'car',
        tint: { color: '#9FC4E8' },
        target: { kind: 'ask', question: 'Why is Transport RM20 over?' },
      },
      {
        title: '3 captures to review',
        meta: 'RM115.80 · not in your totals yet',
        icon: 'inbox-arrow-down',
        tint: 'lilac',
        target: { kind: 'ask', question: 'Show my 3 captures' },
      },
      {
        title: 'Netflix is due tomorrow',
        meta: 'RM54.90 from Maybank Savings',
        icon: 'repeat',
        tint: 'lemon',
        target: { kind: 'ask', question: 'When does Netflix go out?' },
      },
    ]);
  });
});
