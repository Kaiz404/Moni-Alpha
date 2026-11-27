import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import { BudgetDraftCard } from '@/components/chat/budget-draft-card';
import { appendMessage, deleteThread, readTodayThread, type ChatMessage } from '@/lib/ai/chat/messages';
import { todayThreadDay } from '@/lib/ai/chat/sessions';
import { pickedSuggestion$ } from '@/lib/budget/suggestion';
import { setMonthlyBudget, upsertCategoryBudget } from '@/lib/supabase/category-budgets';
import { showToast } from '@/lib/toast/toast-store';

jest.mock('expo-router', () => ({ router: { back: jest.fn(), push: jest.fn() } }));
jest.mock('uniwind', () => ({
  useCSSVariable: (names: string[]) => names.map(() => undefined),
  useUniwind: () => ({ theme: 'light' }),
}));
jest.mock('@/lib/auth/auth-context', () => ({ useAuth: () => ({ user: { id: 'user_1' } }) }));
jest.mock('@/lib/finance/main-currency', () => ({ useMainCurrency: () => 'MYR' }));
jest.mock('@/lib/supabase/category-budgets', () => ({
  upsertCategoryBudget: jest.fn(async () => {}),
  setMonthlyBudget: jest.fn(async () => {}),
}));
jest.mock('@/lib/toast/toast-store', () => ({ showToast: jest.fn() }));

type Draft = Extract<ChatMessage, { kind: 'assistant_budget_draft' }>;

const day = todayThreadDay();
const draft = (patch: Partial<Draft>): Draft => ({
  id: 'budget-draft',
  role: 'assistant',
  kind: 'assistant_budget_draft',
  createdAt: new Date().toISOString(),
  target: { kind: 'category', id: 'food', name: 'Food & Dining' },
  into: 'save',
  amountMinor: 45000,
  note: 'Near your usual.',
  average: 'You averaged RM420 over 3 months',
  ...patch,
});

/** Renders the card for the stored message, as the thread does after each write. */
function renderStored() {
  const view = render(<BudgetDraftCard message={readTodayThread().messages.at(-1) as Draft} />);
  return () => view.rerender(<BudgetDraftCard message={readTodayThread().messages.at(-1) as Draft} />);
}

beforeEach(() => {
  jest.clearAllMocks();
  deleteThread(day);
  pickedSuggestion$.set(null);
});
afterAll(() => deleteThread(day));

describe("Moni's suggested budget in chat", () => {
  it('shows the amount, the average and Moni\'s note, and Set budget saves it', async () => {
    appendMessage(draft({}));
    const refresh = renderStored();
    expect(screen.getByText('RM450 a month')).toBeTruthy();
    expect(screen.getByText('You averaged RM420 over 3 months')).toBeTruthy();
    expect(screen.getByText('Near your usual.')).toBeTruthy();

    fireEvent.press(screen.getByText('Set budget'));
    await waitFor(() => expect(upsertCategoryBudget).toHaveBeenCalledWith('food', 'MYR', 45000));
    refresh();
    expect(screen.getByText('Food & Dining set to RM450')).toBeTruthy();
  });

  it('hands the amount to Edit budgets instead of saving when asked from there', () => {
    appendMessage(draft({ into: 'edit' }));
    renderStored();
    fireEvent.press(screen.getByText('Use this amount'));

    expect(pickedSuggestion$.peek()).toEqual({
      target: { kind: 'category', id: 'food', name: 'Food & Dining' },
      amountMinor: 45000,
    });
    expect(upsertCategoryBudget).not.toHaveBeenCalled();
    expect(router.back).toHaveBeenCalled();
  });

  it('keeps the card and says so when the monthly total does not save', async () => {
    jest.mocked(setMonthlyBudget).mockRejectedValueOnce(new Error('offline'));
    appendMessage(draft({ target: { kind: 'total' } }));
    renderStored();
    fireEvent.press(screen.getByText('Set budget'));

    await waitFor(() =>
      expect(showToast).toHaveBeenCalledWith({ text: "Couldn't save that. Try again.", tone: 'removed' }),
    );
    expect(setMonthlyBudget).toHaveBeenCalledWith(450);
    expect(readTodayThread().messages.at(-1)).toMatchObject({ kind: 'assistant_budget_draft' });
    expect(readTodayThread().messages.at(-1)).not.toHaveProperty('done');
  });
});
