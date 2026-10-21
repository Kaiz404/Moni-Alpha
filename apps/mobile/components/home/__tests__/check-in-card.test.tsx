import {
  fireEvent,
  render,
  screen,
} from '@testing-library/react-native';
import { router } from 'expo-router';

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

import { CheckInCard } from '../check-in-card';

jest.mock('@/lib/auth/auth-context', () => ({
  useAuth: () => ({ user: { id: 'user_1' } }),
}));
jest.mock('uniwind', () => ({
  useCSSVariable: (names: string[]) => names.map(() => undefined),
  withUniwind: <T,>(component: T) => component,
}));
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('@/lib/haptics', () => ({ approve: jest.fn() }));
jest.mock('@/lib/supabase/wallets', () => ({
  confirmWalletBalance: jest.fn(
    (id: string, at: string | null = new Date().toISOString()) => {
      const { financeProjection$: projection$ } = jest.requireActual(
        '@/lib/finance/projection',
      );
      projection$.walletsById[id].set({
        ...projection$.walletsById[id].peek(),
        balanceConfirmedAt: at,
      });
    },
  ),
}));

describe('CheckInCard', () => {
  beforeEach(() => {
    jest.useFakeTimers({ now: NOW });
    jest.mocked(confirmWalletBalance).mockClear();
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
          expense('t2', daysAgo(50), { walletId: 'sgd', currency: 'SGD' }),
        ],
      ),
    );
  });
  afterEach(() => jest.useRealTimers());

  it('asks about the main-currency wallet only, in its own currency', () => {
    render(<CheckInCard currency="MYR" />);
    expect(screen.getByText('Is Maybank still RM2,900.00?')).toBeTruthy();
    expect(screen.getByText('Check-in · last done 40 days ago')).toBeTruthy();
    expect(screen.queryByText(/DBS/)).toBeNull();
  });

  it("confirms once on That's right, and Undo puts the earlier check back", () => {
    render(<CheckInCard currency="MYR" />);
    fireEvent.press(screen.getByTestId('home.check-in.right'));
    expect(confirmWalletBalance).toHaveBeenCalledTimes(1);
    expect(confirmWalletBalance).toHaveBeenCalledWith('maybank');
    expect(approve).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('home.check-in.done')).toHaveTextContent(
      'Maybank is RM2,900.00. Thanks for checking.',
    );

    fireEvent.press(screen.getByTestId('home.check-in.undo'));
    expect(
      financeProjection$.walletsById.maybank.balanceConfirmedAt.peek(),
    ).toBe(daysAgo(40));
    expect(screen.getByText('Is Maybank still RM2,900.00?')).toBeTruthy();
  });

  it('opens the wallet page in its balance edit to fix it', () => {
    render(<CheckInCard currency="MYR" />);
    fireEvent.press(screen.getByTestId('home.check-in.fix'));
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/wallet/[id]',
      params: { id: 'maybank', edit: 'balance' },
    });
  });

  it('hides on Not now and comes back on Undo', () => {
    render(<CheckInCard currency="MYR" />);
    fireEvent.press(screen.getByTestId('home.check-in.not-now'));
    expect(screen.getByTestId('home.check-in.done')).toHaveTextContent(
      'Moni will ask about Maybank again next week.',
    );
    fireEvent.press(screen.getByTestId('home.check-in.undo'));
    expect(screen.getByText('Is Maybank still RM2,900.00?')).toBeTruthy();
  });

  it('renders nothing when every main-currency balance is fresh', () => {
    financeProjection$.set(
      projection([financeWallet({ balanceConfirmedAt: daysAgo(1) })]),
    );
    render(<CheckInCard currency="MYR" />);
    expect(screen.toJSON()).toBeNull();
  });
});
