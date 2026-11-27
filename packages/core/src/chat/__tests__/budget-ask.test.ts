import { describe, expect, it } from 'vitest';

import {
  budgetAnswers,
  budgetAverageLine,
  budgetReply,
  budgetRequestText,
  budgetTargets,
  type BudgetAsk,
} from '../budget-ask';

const food = { kind: 'category', id: 'food', name: 'Food & Dining' } as const;
const ask: BudgetAsk = {
  target: food,
  questions: [
    { text: 'How often do you eat out?', choices: ['Most days', 'Rarely'] },
    { text: 'Any big meals coming up?', choices: [] },
  ],
  answers: [],
};

describe('suggest a budget in Moni chat', () => {
  it('offers the monthly total, then each category', () => {
    expect(budgetTargets([{ id: 'food', name: 'Food & Dining' }])).toEqual([{ kind: 'total' }, food]);
  });

  it('says the request in the user words', () => {
    expect(budgetRequestText(null)).toBe('Suggest a budget');
    expect(budgetRequestText({ kind: 'total' })).toBe('Suggest a monthly total');
    expect(budgetRequestText(food)).toBe('Suggest a budget for Food & Dining');
  });

  it('matches a typed pick by name, ignoring case, and asks again for anything else', () => {
    const pick = { kind: 'pick', targets: budgetTargets([{ id: 'food', name: 'Food & Dining' }]) } as const;
    expect(budgetReply(pick, ' monthly TOTAL ')).toEqual({ kind: 'ask', target: { kind: 'total' } });
    expect(budgetReply(pick, 'Food & Dining')).toEqual({ kind: 'ask', target: food });
    expect(budgetReply(pick, 'groceries please')).toEqual({ kind: 'repick' });
  });

  it('asks the next question, then suggests once every question has an answer, typed or tapped', () => {
    const first = budgetReply({ kind: 'question', ask }, 'Most days');
    expect(first).toEqual({
      kind: 'next',
      ask: { ...ask, answers: ['Most days'] },
      question: { text: 'Any big meals coming up?', choices: [] },
    });
    const second = budgetReply({ kind: 'question', ask: { ...ask, answers: ['Most days'] } }, 'a wedding in December');
    expect(second).toEqual({ kind: 'suggest', ask: { ...ask, answers: ['Most days', 'a wedding in December'] } });
    expect(budgetAnswers({ ...ask, answers: ['Most days', 'a wedding in December'] })).toEqual([
      { question: 'How often do you eat out?', answer: 'Most days' },
      { question: 'Any big meals coming up?', answer: 'a wedding in December' },
    ]);
  });

  it('keeps a typed answer within the 200 characters the gateway takes', () => {
    const long = budgetReply({ kind: 'question', ask }, 'x'.repeat(250));
    expect(long.kind === 'next' && long.ask.answers[0]!.length).toBe(200);
  });

  it('averages the months the suggestion starts from', () => {
    expect(budgetAverageLine([{ spentMinor: 40000 }, { spentMinor: 50000 }], 'MYR')).toBe('You averaged RM450 over 2 months');
    expect(budgetAverageLine([{ spentMinor: 12000 }], 'MYR')).toBe('You averaged RM120 over 1 month');
    expect(budgetAverageLine([], 'MYR')).toBeNull();
  });
});
