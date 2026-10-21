import {
  fireEvent,
  render,
  screen,
} from '@testing-library/react-native';
import { router } from 'expo-router';
import { formatMinorAmount } from '@/lib/finance/money';
import { financeProjection$ } from '@/lib/finance/projection';
import { approve } from '@/lib/haptics';
import { confirmWalletBalance } from '@/lib/supabase/wallets';
import {
  NOW,
  daysAgo,
  expense,
  financeWallet,
  projection,
} from '@/lib/wallets/__tests__/balance-fixture';
import { ConfirmBalanceCard } from '../confirm-balance-card';

jest.mock('@/lib/auth/auth-context', () => ({
  useAuth: () => ({ user: { id: 'user_1' } }),
}));
jest.mock('uniwind', () => ({
  useCSSVariable: (names: string[]) => names.map(() => undefined),
  withUniwind: <T,>(component: T) => component,
}));
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('@/lib/haptics', () => ({
  approve: jest.fn(),
}));
jest.mock('@/lib/supabase/wallets', () => ({
  confirmWalletBalance: jest.fn((id: string) => {
    const { financeProjection$: projection$ } = jest.requireActual(
      '@/lib/finance/projection',
    );
    projection$.walletsById[id].set({
      ...projection$.walletsById[id].peek(),
      balanceConfirmedAt: new Date().toISOString(),
    });
  }),
}));

describe('ConfirmBalanceCard', () => {
  beforeEach(() => {
    jest.useFakeTimers({ now: NOW });
    financeProjection$.set(
      projection(
        [
          financeWallet(),
          financeWallet({
            id: 'sgd',
            name: 'DBS',
            currency: 'SGD',
            balanceConfirmedAt: null,
          }),
        ],
        [
          expense('t1', daysAgo(60)),
          expense('t2', daysAgo(50), {
            walletId: 'sgd',
            currency: 'SGD',
          }),
        ],
      ),
    );
  });
  afterEach(() => jest.useRealTimers());

  it('lists each wallet in its own currency and drops a row once confirmed', () => {
    render(<ConfirmBalanceCard />);
    expect(
      screen.getByText('Confirm balances to unlock your forecast'),
    ).toBeTruthy();
    expect(screen.getByText('Checked 40 days ago')).toBeTruthy();
    expect(screen.getByText('Never checked')).toBeTruthy();
    expect(
      screen.getByText(formatMinorAmount(290000, 'MYR')),
    ).toBeTruthy();
    expect(
      screen.getByText(formatMinorAmount(290000, 'SGD')),
    ).toBeTruthy();

    fireEvent.press(screen.getByLabelText(/^Yes, Maybank is /));
    expect(confirmWalletBalance).toHaveBeenCalledWith('maybank');
    expect(approve).toHaveBeenCalled();
    expect(screen.queryByText('Maybank')).toBeNull();
    expect(screen.getByText('DBS')).toBeTruthy();
  });

  it('opens the wallet screen to fix a balance', () => {
    render(<ConfirmBalanceCard />);
    fireEvent.press(screen.getByLabelText('Fix the Maybank balance'));
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/wallet/[id]',
      params: { id: 'maybank' },
    });
  });

  it('renders nothing when every balance is fresh', () => {
    financeProjection$.set(
      projection([financeWallet({ balanceConfirmedAt: daysAgo(1) })]),
    );
    render(<ConfirmBalanceCard />);
    expect(screen.toJSON()).toBeNull();
  });

  it('hides on "Not now"', () => {
    render(<ConfirmBalanceCard />);
    fireEvent.press(
      screen.getByLabelText('Not now, ask again in a week'),
    );
    expect(screen.toJSON()).toBeNull();
  });
});
