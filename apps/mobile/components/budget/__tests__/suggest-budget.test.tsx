import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { router, useLocalSearchParams } from 'expo-router';
import type { ReactNode } from 'react';

import SuggestBudgetScreen from '@/app/budget/suggest';
import { getAiClient } from '@/lib/ai/client';
import { pickedSuggestion$ } from '@/lib/budget/suggestion';
import { setMonthlyBudget, upsertCategoryBudget } from '@/lib/supabase/category-budgets';
import { showToast } from '@/lib/toast/toast-store';

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), push: jest.fn() },
  useLocalSearchParams: jest.fn(),
}));
jest.mock('@/components/ui/page', () => ({
  ...jest.requireActual('@/components/ui/page'),
  Page: ({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) => {
    const { Text, View } = require('react-native');
    return (
      <View>
        <Text>{title}</Text>
        {subtitle ? <Text>{subtitle}</Text> : null}
        {children}
      </View>
    );
  },
}));
jest.mock('uniwind', () => ({
  useCSSVariable: (names: string[]) => names.map(() => undefined),
  useUniwind: () => ({ theme: 'light' }),
}));
jest.mock('@/components/budget/use-budget', () => ({
  useBudgetData: () => ({
    currency: 'MYR',
    now: new Date('2026-10-14T06:00:00Z'),
    transactions: [],
    categories: [{ id: 'food', name: 'Food & Dining', icon: 'silverware-fork-knife', color: '#FB7F77' }],
  }),
}));
jest.mock('@/lib/ai/consent/use-ai-gate', () => ({ useAiGate: () => (action: () => void) => action() }));
jest.mock('@/lib/ai/client', () => ({ getAiClient: jest.fn() }));
jest.mock('@/lib/store', () => ({ profilePreferences$: { peek: () => ({ moni_tone: 'direct' }) } }));
jest.mock('@/lib/supabase/category-budgets', () => ({
  upsertCategoryBudget: jest.fn(async () => {}),
  setMonthlyBudget: jest.fn(async () => {}),
}));
jest.mock('@/lib/toast/toast-store', () => ({ showToast: jest.fn() }));

const suggestBudget = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  pickedSuggestion$.set(null);
  jest.mocked(getAiClient).mockReturnValue({ suggestBudget } as never);
  suggestBudget
    .mockResolvedValueOnce({
      status: 'ok',
      step: 'questions',
      questions: [{ text: 'How often do you eat out?', choices: ['Most days', 'Rarely'] }],
      modelId: 'm',
    })
    .mockResolvedValueOnce({ status: 'ok', step: 'suggestion', amountMinor: 45000, note: 'Near your usual.', modelId: 'm' });
});

async function answerAndSuggest() {
  render(<SuggestBudgetScreen />);
  fireEvent.press(await screen.findByTestId('budget.suggest.answer.0.most-days'));
  fireEvent.press(screen.getByTestId('budget.suggest.next'));
  await screen.findByText('Near your usual.');
}

describe('Ask Moni to suggest a budget', () => {
  it("asks Moni's questions, sends the answers, and sets the suggested budget", async () => {
    jest.mocked(useLocalSearchParams).mockReturnValue({ category: 'food' });
    await answerAndSuggest();

    expect(suggestBudget.mock.calls.map(([req]) => req)).toEqual([
      { category: 'Food & Dining', currency: 'MYR', months: [], answers: [], tone: 'direct' },
      {
        category: 'Food & Dining',
        currency: 'MYR',
        months: [],
        answers: [{ question: 'How often do you eat out?', answer: 'Most days' }],
        tone: 'direct',
      },
    ]);
    expect(screen.getByText('RM450 a month')).toBeTruthy();

    fireEvent.press(screen.getByTestId('budget.suggest.set'));
    await screen.findByText('RM450 a month');
    expect(upsertCategoryBudget).toHaveBeenCalledWith('food', 'MYR', 45000);
  });

  it('hands the amount to Edit budgets instead of saving when opened from there', async () => {
    jest.mocked(useLocalSearchParams).mockReturnValue({ from: 'edit' });
    render(<SuggestBudgetScreen />);
    fireEvent.press(screen.getByTestId('budget.suggest.pick.food-dining'));
    fireEvent.press(await screen.findByTestId('budget.suggest.answer.0.most-days'));
    fireEvent.press(screen.getByTestId('budget.suggest.next'));
    fireEvent.press(await screen.findByText('Use this amount'));

    expect(pickedSuggestion$.peek()).toEqual({
      target: { kind: 'category', id: 'food', name: 'Food & Dining' },
      amountMinor: 45000,
    });
    expect(upsertCategoryBudget).not.toHaveBeenCalled();
    expect(router.back).toHaveBeenCalled();
  });

  it('stays open with the amount and says so when the monthly total does not save', async () => {
    jest.mocked(useLocalSearchParams).mockReturnValue({});
    jest.mocked(setMonthlyBudget).mockRejectedValueOnce(new Error('offline'));
    render(<SuggestBudgetScreen />);
    fireEvent.press(screen.getByTestId('budget.suggest.pick.monthly-total'));
    fireEvent.press(await screen.findByTestId('budget.suggest.answer.0.most-days'));
    fireEvent.press(screen.getByTestId('budget.suggest.next'));
    fireEvent.press(await screen.findByText('Set budget'));

    await waitFor(() => expect(showToast).toHaveBeenCalledWith({ text: "Couldn't save that. Try again.", tone: 'removed' }));
    expect(setMonthlyBudget).toHaveBeenCalledWith(450);
    expect(router.back).not.toHaveBeenCalled();
    expect(screen.getByText('RM450 a month')).toBeTruthy();
  });

  it("says so when Moni can't suggest one, with Try again", async () => {
    jest.mocked(useLocalSearchParams).mockReturnValue({ category: 'food' });
    suggestBudget.mockReset().mockResolvedValue({ status: 'unavailable', reason: 'consent' });
    render(<SuggestBudgetScreen />);
    expect(await screen.findByText("Moni couldn't suggest one right now.")).toBeTruthy();
    expect(screen.getByTestId('budget.suggest.retry')).toBeTruthy();
  });
});
