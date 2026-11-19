import type { Observable } from '@legendapp/state';
import { updateProfilePreferences } from '@repo/data';
import { setMonthlyBudget } from '../category-budgets';

jest.mock('expo-crypto', () => ({ randomUUID: () => 'budget-1' }));
jest.mock('@repo/data', () => ({ updateProfilePreferences: jest.fn() }));
jest.mock('@/lib/supabase/client', () => ({ getUserId: async () => 'user-1', supabase: {} }));
jest.mock('@/lib/store', () => {
  const { observable } = jest.requireActual('@legendapp/state');
  return { categoryBudgets$: observable({}), profilePreferences$: observable({ monthly_budget: 2000, moni_tone: 'warm' }) };
});

const { profilePreferences$ } = jest.requireMock('@/lib/store') as {
  profilePreferences$: Observable<Record<string, unknown>>;
};

describe('setMonthlyBudget', () => {
  it('shows the new total at once and keeps it when the profile saves', async () => {
    jest.mocked(updateProfilePreferences).mockResolvedValueOnce({} as never);
    await setMonthlyBudget(2500);
    expect(profilePreferences$.peek()?.monthly_budget).toBe(2500);
  });

  it('puts the old total back and throws when the save is refused', async () => {
    profilePreferences$.set({ monthly_budget: 2000, moni_tone: 'warm' });
    jest.mocked(updateProfilePreferences).mockRejectedValueOnce(new Error('offline'));
    await expect(setMonthlyBudget(3000)).rejects.toThrow('offline');
    expect(profilePreferences$.peek()).toEqual({ monthly_budget: 2000, moni_tone: 'warm' });
  });
});
