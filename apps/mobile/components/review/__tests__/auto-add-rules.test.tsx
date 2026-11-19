import { fireEvent, render, screen } from '@testing-library/react-native';

import { AutoAddRules } from '@/components/review/auto-add-rules';
import { deleteAutoAddRule } from '@/lib/supabase/auto-add-rules';
import { showToast } from '@/lib/toast/toast-store';

jest.mock('@/lib/auth/auth-context', () => ({ useAuth: () => ({ user: { id: 'user-1' } }) }));
jest.mock('@/lib/store', () => {
  const { observable } = jest.requireActual('@legendapp/state');
  return { categories$: observable({ 'cat-subs': { name: 'Subscriptions' } }) };
});
jest.mock('@/lib/supabase/merchant-aliases', () => ({ listMerchantAliases: () => [] }));
jest.mock('@/lib/supabase/auto-add-rules', () => ({
  listAutoAddRules: () => [
    {
      id: 'rule-1',
      userId: 'user-1',
      merchantKey: 'spotify',
      sourceApp: 'com.maybank2u.life',
      walletId: 'wallet-1',
      categoryId: 'cat-subs',
      createdAt: '2026-10-01T00:00:00.000Z',
      updatedAt: '2026-10-01T00:00:00.000Z',
      deleted: false,
    },
  ],
  createAutoAddRule: jest.fn(async () => {}),
  deleteAutoAddRule: jest.fn(),
}));
jest.mock('@/components/capture-sources/linked-app-row', () => ({ AppBubble: () => null }));
jest.mock('@/lib/toast/toast-store', () => ({ showToast: jest.fn() }));

describe('AutoAddRules', () => {
  it('says what each rule does and Ask again deletes it', () => {
    render(<AutoAddRules />);
    expect(screen.getByText("Don't ask about similar")).toBeTruthy();
    expect(screen.getByText('Spotify')).toBeTruthy();
    expect(screen.getByText('Adds to Subscriptions without asking')).toBeTruthy();

    fireEvent.press(screen.getByTestId('review.rule.spotify.ask-again'));
    expect(deleteAutoAddRule).toHaveBeenCalledWith('rule-1');
    expect(jest.mocked(showToast).mock.calls[0]?.[0].text).toBe('Moni will ask about Spotify again');
  });
});
