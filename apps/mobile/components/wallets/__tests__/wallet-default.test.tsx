import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { updateProfilePreferences } from '@/lib/supabase/profile';
import { financeWallet } from '@/lib/wallets/__tests__/balance-fixture';
import { getDefaultWalletId } from '@/lib/wallets/default-wallet';
import { WalletDefault } from '../wallet-sections';

jest.mock('uniwind', () => ({
  useCSSVariable: (names: string[]) => names.map(() => undefined),
  useUniwind: () => ({ theme: 'light' }),
}));
jest.mock('@/lib/supabase/profile', () => ({
  getProfilePreferences: jest.fn(async () => ({})),
  updateProfilePreferences: jest.fn(async () => {}),
}));

describe('WalletDefault', () => {
  it('makes this wallet the default for captures and clears it again', async () => {
    render(<WalletDefault wallet={financeWallet()} />);
    const toggle = screen.getByTestId('wallet.default');
    expect(toggle).not.toBeChecked();

    await act(async () => fireEvent.press(toggle));
    expect(getDefaultWalletId()).toBe('maybank');
    expect(updateProfilePreferences).toHaveBeenLastCalledWith({ default_wallet_id: 'maybank' });
    expect(screen.getByTestId('wallet.default')).toBeChecked();

    await act(async () => fireEvent.press(toggle));
    expect(getDefaultWalletId()).toBeNull();
    expect(updateProfilePreferences).toHaveBeenLastCalledWith({ default_wallet_id: null });
  });

  it('keeps the old default when saving fails', async () => {
    jest.mocked(updateProfilePreferences).mockRejectedValueOnce(new Error('offline'));
    render(<WalletDefault wallet={financeWallet()} />);

    await act(async () => fireEvent.press(screen.getByTestId('wallet.default')));

    expect(getDefaultWalletId()).toBeNull();
    expect(screen.getByTestId('wallet.default')).not.toBeChecked();
  });
});
