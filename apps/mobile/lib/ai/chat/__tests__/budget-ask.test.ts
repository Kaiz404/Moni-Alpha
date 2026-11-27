import { getAiClient } from '@/lib/ai/client';
import { answerBudgetStep, openBudgetStep, startBudgetAsk } from '@/lib/ai/chat/budget-ask';
import { deleteThread, readTodayThread, type ChatMessage } from '@/lib/ai/chat/messages';
import { todayThreadDay } from '@/lib/ai/chat/sessions';

let mockNextId = 0;
jest.mock('expo-crypto', () => ({ randomUUID: () => `message-${++mockNextId}` }));
jest.mock('@/lib/ai/client', () => ({ getAiClient: jest.fn() }));
jest.mock('@/lib/supabase/client', () => ({ getUserId: async () => 'user_1' }));
jest.mock('@/lib/supabase/recurring-overrides', () => ({ listRecurringOverrides: () => [] }));
jest.mock('@/lib/store', () => ({
  profilePreferences$: { peek: () => ({ moni_tone: 'direct', main_currency: 'MYR', monthly_budget: null }) },
}));
jest.mock('@/lib/finance/main-currency', () => ({ selectMainCurrency: () => 'MYR' }));
jest.mock('@/lib/finance/projection', () => ({
  financeProjection$: {
    peek: () => ({
      categoriesById: {
        food: { id: 'food', name: 'Food & Dining', userId: null, isActive: true, type: 'expense' },
        pay: { id: 'pay', name: 'Salary', userId: null, isActive: true, type: 'income' },
      },
      budgetsById: {},
    }),
  },
}));
jest.mock('@/lib/finance/selectors', () => ({
  transactions$: () => ({ peek: () => [] }),
  debtsWithBalance$: () => ({ peek: () => [] }),
}));

const suggestBudget = jest.fn();
const day = todayThreadDay();
const thread = () => readTodayThread().messages;
const said = () =>
  thread().flatMap((message: ChatMessage) => ('content' in message && message.content ? [message.content] : []));

beforeEach(() => {
  deleteThread(day);
  jest.clearAllMocks();
  jest.mocked(getAiClient).mockReturnValue({ suggestBudget } as never);
  suggestBudget
    .mockResolvedValueOnce({
      status: 'ok',
      step: 'questions',
      questions: [
        { text: 'How often do you eat out?', choices: ['Most days', 'Rarely'] },
        { text: 'Any big meals coming up?', choices: ['No'] },
      ],
      modelId: 'm',
    })
    .mockResolvedValueOnce({ status: 'ok', step: 'suggestion', amountMinor: 45000, note: 'Near your usual.', modelId: 'm' });
});
afterAll(() => deleteThread(day));

describe('Suggest a budget in Moni chat', () => {
  it("asks Moni's questions one message at a time, then drafts the amount from the answers", async () => {
    await startBudgetAsk({ kind: 'category', id: 'food', name: 'Food & Dining' }, 'save');
    expect(said()).toEqual(['Suggest a budget for Food & Dining', 'How often do you eat out?']);

    await answerBudgetStep(openBudgetStep(thread())!, 'Most days');
    expect(said().at(-1)).toBe('Any big meals coming up?');
    await answerBudgetStep(openBudgetStep(thread())!, 'a wedding in December');

    expect(suggestBudget.mock.calls.map(([request]) => request)).toEqual([
      { category: 'Food & Dining', currency: 'MYR', months: [], answers: [], tone: 'direct' },
      {
        category: 'Food & Dining',
        currency: 'MYR',
        months: [],
        answers: [
          { question: 'How often do you eat out?', answer: 'Most days' },
          { question: 'Any big meals coming up?', answer: 'a wedding in December' },
        ],
        tone: 'direct',
      },
    ]);
    expect(thread().at(-1)).toMatchObject({
      kind: 'assistant_budget_draft',
      target: { kind: 'category', id: 'food', name: 'Food & Dining' },
      into: 'save',
      amountMinor: 45000,
      note: 'Near your usual.',
      average: null,
    });
    expect(openBudgetStep(thread())).toBeNull();
  });

  it('asks which budget first, offering the total and each spending category', async () => {
    await startBudgetAsk(null, 'edit');
    const pick = openBudgetStep(thread());
    expect(pick).toMatchObject({
      kind: 'assistant_budget_pick',
      content: 'Which budget should I suggest?',
      targets: [{ kind: 'total' }, { kind: 'category', id: 'food', name: 'Food & Dining' }],
      into: 'edit',
    });

    await answerBudgetStep(pick!, 'monthly total');
    expect(suggestBudget.mock.calls[0]![0]).toMatchObject({ category: null, answers: [] });
    expect(said().slice(-2)).toEqual(['monthly total', 'How often do you eat out?']);
  });

  it('asks again when the typed pick names no budget', async () => {
    await startBudgetAsk(null, 'save');
    await answerBudgetStep(openBudgetStep(thread())!, 'groceries please');
    expect(suggestBudget).not.toHaveBeenCalled();
    expect(openBudgetStep(thread())).toMatchObject({
      kind: 'assistant_budget_pick',
      content: 'Pick one of these, and I will ask a few questions.',
    });
  });

  it("says so in the thread when Moni can't ask", async () => {
    suggestBudget.mockReset().mockResolvedValue({ status: 'unavailable', reason: 'rate limit' });
    await startBudgetAsk({ kind: 'total' }, 'save');
    expect(thread().at(-1)).toMatchObject({
      kind: 'assistant_text',
      status: 'error',
      content: 'Moni is busy right now. Try again in a minute.',
    });
  });
});
