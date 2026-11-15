import { decimalToMinor } from '@repo/types';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { expense, financeWallet } from '@/lib/wallets/__tests__/balance-fixture';
import { WalletBalanceChart } from '../wallet-balance-chart';

jest.mock('@/lib/haptics', () => ({ scrubStep: jest.fn(), chartStep: jest.fn() }));
jest.mock('uniwind', () => ({
  useCSSVariable: (names: string[]) => names.map(() => undefined),
  useUniwind: () => ({ theme: 'light' }),
}));

const now = new Date(2026, 9, 14, 14, 6);
const on = (month: number, day: number) => new Date(2026, month - 1, day, 12).toISOString();

function chart() {
  render(
    <WalletBalanceChart
      wallet={financeWallet({ createdAt: on(8, 1) })}
      balanceMinor={decimalToMinor('5000')}
      now={now}
      transactions={[
        expense('pay', on(10, 1), { type: 'income', amountMinor: decimalToMinor('4550') }),
        expense('grab', on(10, 13), { amountMinor: decimalToMinor('45.90') }),
        expense('tng', on(10, 12), {
          type: 'transfer',
          transferToWalletId: 'tng',
          amountMinor: decimalToMinor('100'),
        }),
        expense('fix', on(10, 5), { balanceCorrection: true, amountMinor: decimalToMinor('3') }),
        expense('sept', on(9, 30)),
      ]}
    />,
  );
}

const shown = () => ({
  window: screen.getByTestId('wallet.chart.window').props.children,
  earlier: !screen.getByTestId('wallet.chart.earlier').props.accessibilityState.disabled,
  later: !screen.getByTestId('wallet.chart.later').props.accessibilityState.disabled,
});

describe('WalletBalanceChart', () => {
  it('opens on this month: how far the balance moved since the 1st, and what went in, out, and between wallets', () => {
    chart();
    expect(shown()).toEqual({ window: 'October', earlier: true, later: false });
    expect(screen.getByText('Up RM4,401.10 since 1 Oct')).toBeTruthy();
    expect(screen.getByText('In +RM4,550.00 · Out −RM45.90 · Moved RM100.00')).toBeTruthy();
    expect(screen.getByTestId('wallet.chart.plot').props.accessibilityValue.text).toBe(
      'Today, RM5,000.00',
    );
  });

  it('steps back a month at a time to the month the wallet began, and forward again', () => {
    chart();
    fireEvent.press(screen.getByTestId('wallet.chart.earlier'));
    expect(shown()).toEqual({ window: 'September', earlier: true, later: true });
    expect(screen.getByText('Down RM100.00')).toBeTruthy();
    expect(screen.getByText('Out −RM100.00')).toBeTruthy();
    expect(screen.getByTestId('wallet.chart.plot').props.accessibilityLabel).toBe(
      'Maybank balance, 1 Sep to 30 Sep, from RM698.90 to RM598.90. The axis starts at RM550, not zero.',
    );

    fireEvent.press(screen.getByTestId('wallet.chart.earlier'));
    expect(shown()).toEqual({ window: 'August', earlier: false, later: true });
    expect(screen.getByText('No change')).toBeTruthy();

    fireEvent.press(screen.getByTestId('wallet.chart.later'));
    fireEvent.press(screen.getByTestId('wallet.chart.later'));
    expect(shown()).toEqual({ window: 'October', earlier: true, later: false });
  });

  it('steps any range by its own length, starts a new range at today, and has no steps on All', () => {
    chart();
    fireEvent.press(screen.getByTestId('wallet.chart.30d'));
    expect(shown()).toEqual({ window: 'Last 30 days', earlier: true, later: false });
    expect(screen.getByText('Up RM4,301.10 since 15 Sep')).toBeTruthy();

    fireEvent.press(screen.getByTestId('wallet.chart.earlier'));
    expect(shown().window).toBe('16 Aug to 14 Sep');

    fireEvent.press(screen.getByTestId('wallet.chart.7d'));
    expect(shown()).toEqual({ window: 'Last 7 days', earlier: true, later: false });

    fireEvent.press(screen.getByTestId('wallet.chart.all'));
    expect(screen.getByTestId('wallet.chart.window').props.children).toBe('All time');
    expect(screen.queryByTestId('wallet.chart.earlier')).toBeNull();
  });
});
