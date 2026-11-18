import { analyzeUserFinances } from '@/lib/ai/chat/analyze';
import { profilePreferences$ } from '@/lib/store';

const mockAnalyzeFinances = jest.fn();
jest.mock('@/lib/ai/client', () => ({
  getAiClient: () => ({ analyzeFinances: mockAnalyzeFinances }),
}));
jest.mock('@/lib/supabase/client', () => ({ getUserId: async () => 'user-1' }));
jest.mock('@/lib/supabase/recurring-overrides', () => ({ listRecurringOverrides: () => [] }));
jest.mock('@/lib/store', () => {
  const { observable } = jest.requireActual('@legendapp/state');
  return { profilePreferences$: observable(undefined) };
});
jest.mock('@/lib/finance/projection', () => {
  const { observable } = jest.requireActual('@legendapp/state');
  return {
    financeProjection$: observable({
      transactionsById: {},
      budgetsById: {},
      categoriesById: {},
      proposalsById: {},
      walletsById: {},
    }),
  };
});

describe('analyzeUserFinances', () => {
  beforeEach(() => {
    mockAnalyzeFinances.mockReset();
    mockAnalyzeFinances.mockResolvedValue({ status: 'ok', reply: 'Short answer.', modelId: 'm' });
  });

  it("sends the tone the user picked for Moni", async () => {
    profilePreferences$.set({ currency: 'MYR', theme: 'system', notifications_enabled: true, moni_tone: 'playful' });

    await expect(analyzeUserFinances('What can you do?')).resolves.toEqual({ ok: true, reply: 'Short answer.' });
    expect(mockAnalyzeFinances.mock.calls[0][0]).toMatchObject({ message: 'What can you do?', tone: 'playful' });
  });

  it('sends no tone before the user picks one, so the backend answers friendly', async () => {
    profilePreferences$.set(undefined);

    await analyzeUserFinances('What can you do?');
    expect(mockAnalyzeFinances.mock.calls[0][0].tone).toBeUndefined();
  });
});
