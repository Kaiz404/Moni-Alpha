import type { MinorAmount } from '@repo/types';
import {
  act,
  fireEvent,
  render,
  screen,
} from '@testing-library/react-native';

import { NetWorthChart } from '@/components/wallets/net-worth-chart';
import {
  netWorthTarget,
  walletLineStyles,
} from '@/components/wallets/net-worth-geometry';
import { balanceIndex } from '@/lib/finance/balance-history';
import type {
  FinanceTransaction,
  FinanceWallet,
} from '@/lib/finance/types';
import { chartStep } from '@/lib/haptics';
import {
  expense,
  financeWallet,
} from '@/lib/wallets/__tests__/balance-fixture';

jest.mock('@/lib/haptics', () => ({ scrubStep: jest.fn(), chartStep: jest.fn() }));
jest.mock('uniwind', () => ({
  useCSSVariable: (names: string[]) => names.map(() => undefined),
  useUniwind: () => ({ theme: 'light' }),
}));

const now = new Date(2026, 9, 14, 14, 6);
const on = (month: number, day: number) =>
  new Date(2026, month - 1, day, 12).toISOString();
const old = new Date(2020, 0, 1).toISOString();
const money = (minor: number) => minor as MinorAmount;

const maybank = financeWallet({
  id: 'maybank',
  name: 'Maybank Savings',
  cardStyleId: null,
  createdAt: old,
});
const cash = financeWallet({
  id: 'cash',
  name: 'Cash',
  type: 'cash',
  cardStyleId: 'emerald-grain',
  createdAt: on(10, 12),
});

function chart(
  wallets: FinanceWallet[],
  transactions: FinanceTransaction[] = [],
) {
  return render(
    <NetWorthChart
      now={now}
      currency="MYR"
      totalMinor={250000}
      wallets={wallets}
      balances={{ maybank: 240000, cash: 10000 }}
      transactions={transactions}
    />,
  );
}

describe('NetWorthChart', () => {
  afterEach(() => jest.useRealTimers());

  it('shows the live number, thirty days by default, and a total callout on today', () => {
    chart([maybank, cash]);
    expect(
      screen.getByTestId('wallet.list.net-worth'),
    ).toHaveTextContent('RM2,500.00');
    expect(
      screen.getByTestId('wallet.chart.callout'),
    ).toHaveTextContent('RM2,500.00');
    for (const monday of ['21 Sep', '28 Sep', '5 Oct', '12 Oct'])
      expect(screen.getByText(monday)).toBeTruthy();
    expect(screen.getAllByText('Today')).toHaveLength(2);
    expect(
      screen.getByTestId('wallet.chart.30d').props.accessibilityState
        .selected,
    ).toBe(true);
    expect(screen.queryByTestId('wallet.chart.key')).toBeNull();
    expect(screen.queryByText(/closing balance each day/)).toBeNull();
  });

  it('dates the axis by the range: Mondays on 30D, quarters on 1Y, the month on 1M', () => {
    jest.useFakeTimers();
    chart([maybank, cash]);
    fireEvent.press(screen.getByTestId('wallet.chart.1y'));
    act(() => jest.advanceTimersByTime(150));
    expect(
      screen.getByTestId('wallet.chart.1y').props.accessibilityState
        .selected,
    ).toBe(true);
    for (const quarter of ['Jan 2026', 'Apr', 'Jul', 'Oct'])
      expect(screen.getByText(quarter)).toBeTruthy();
    expect(screen.queryByText('21 Sep')).toBeNull();
    fireEvent.press(screen.getByTestId('wallet.chart.1m'));
    expect(screen.getByText('1 Oct')).toHaveTextContent('1 Oct');
  });

  it('keys each wallet by short name and value in By wallet, and reads the scrubbed day', () => {
    chart(
      [maybank, cash],
      [expense('grab', on(10, 14), { amountMinor: money(4000) })],
    );
    fireEvent.press(screen.getByTestId('wallet.chart.by-wallet'));

    expect(
      screen.getByTestId('wallet.chart.key.maybank'),
    ).toHaveTextContent('MaybankRM2,400.00');
    expect(
      screen.getByTestId('wallet.chart.key.cash'),
    ).toHaveTextContent('CashRM100.00');

    const plot = screen.getByTestId('wallet.chart.plot');
    expect(plot.props.accessibilityValue.text).toBe(
      'Today, Maybank RM2,400.00, Cash RM100.00',
    );

    const back = { nativeEvent: { actionName: 'decrement' } };
    fireEvent(plot, 'accessibilityAction', back);
    expect(
      screen.getByTestId('wallet.chart.key.maybank'),
    ).toHaveTextContent('MaybankRM2,440.00');
    expect(
      screen.getByTestId('wallet.chart.callout'),
    ).toHaveTextContent('RM2,540.00');
    expect(
      screen.getByTestId('wallet.list.net-worth'),
    ).toHaveTextContent('RM2,500.00');

    for (let times = 0; times < 2; times++)
      fireEvent(plot, 'accessibilityAction', back);
    expect(
      screen.getByTestId('wallet.chart.key.cash'),
    ).toHaveTextContent('CashNot yet');
    expect(plot.props.accessibilityValue.text).toBe(
      'Sun 11 Oct, Maybank RM2,440.00, Cash not yet',
    );
  });

  it('reports each day crossed with how many days the chart holds, so the haptic can stay quiet', () => {
    chart([maybank]);
    fireEvent.press(screen.getByTestId('wallet.chart.1y'));
    (chartStep as jest.Mock).mockClear();
    const plot = screen.getByTestId('wallet.chart.plot');
    for (let times = 0; times < 2; times++)
      fireEvent(plot, 'accessibilityAction', {
        nativeEvent: { actionName: 'decrement' },
      });
    expect((chartStep as jest.Mock).mock.calls).toEqual([[366], [366]]);
  });

  it('returns the callout to today when the range changes', () => {
    chart([maybank, cash]);
    const plot = screen.getByTestId('wallet.chart.plot');
    fireEvent(plot, 'accessibilityAction', {
      nativeEvent: { actionName: 'decrement' },
    });
    expect(plot.props.accessibilityValue.text).toBe(
      'Yesterday, RM2,500.00',
    );
    fireEvent.press(screen.getByTestId('wallet.chart.90d'));
    expect(
      screen.getByTestId('wallet.chart.plot').props.accessibilityValue
        .text,
    ).toBe('Today, RM2,500.00');
  });

  it('hides the toggle for a single wallet', () => {
    chart([maybank]);
    expect(screen.queryByTestId('wallet.chart.by-wallet')).toBeNull();
    expect(
      screen.getByTestId('wallet.chart.plot').props
        .accessibilityLabel,
    ).toContain('Net worth, ');
  });

  it('draws no chart without a main-currency wallet', () => {
    render(
      <NetWorthChart
        now={now}
        currency="MYR"
        totalMinor={0}
        wallets={[]}
        balances={{}}
        transactions={[]}
      />,
    );
    expect(
      screen.getByTestId('wallet.list.net-worth'),
    ).toHaveTextContent('RM0.00');
    expect(screen.queryByTestId('wallet.chart.plot')).toBeNull();
    expect(screen.queryByTestId('wallet.chart.1m')).toBeNull();
  });
});

describe('netWorthTarget', () => {
  const index = balanceIndex({
    now,
    wallets: [{ id: 'maybank', balanceMinor: 243180, createdAt: old }],
    transactions: [
      {
        type: 'expense',
        walletId: 'maybank',
        transferToWalletId: null,
        amountMinor: money(75370),
        transactionDate: on(10, 10),
      },
    ],
  });
  const target = (
    range: '1y' | '1m',
    view: 'total' | 'by-wallet' = 'total',
  ) =>
    netWorthTarget({
      index,
      now,
      range,
      view,
      names: { maybank: 'Maybank' },
      currency: 'MYR',
    });

  it('runs from the first day of the range to today on the 14th, not to the month end', () => {
    const { from, to, count } = target('1m');
    expect(to).toBe(index.days - 1);
    expect([to - from, count]).toEqual([13, 14]);
  });

  it('starts the axis near the lowest balance and says so', () => {
    const { axis, low, high, accessibilityLabel } = target('1m');
    expect([low, high]).toEqual([200000, 350000]);
    expect(axis.map((label) => label.text)).toEqual([
      'RM3,500',
      'RM2,750',
      'RM2,000',
    ]);
    expect(accessibilityLabel).toBe(
      'Net worth, 1 Oct to today, from RM3,185.50 to RM2,431.80. The axis starts at RM2,000, not zero.',
    );
  });

  it('dates a year by quarter and keeps the last day exact', () => {
    const { ticks, count, to } = target('1y');
    expect(ticks.map((tick) => tick.label)).toEqual([
      'Jan 2026',
      'Apr',
      'Jul',
      'Oct',
    ]);
    expect(count).toBe(366);
    expect(index.total[to]).toBe(243180);
  });

  it('holds a single day when the only wallet began today', () => {
    const today = balanceIndex({
      now,
      wallets: [{ id: 'maybank', balanceMinor: 243180, createdAt: on(10, 14) }],
      transactions: [],
    });
    const single = netWorthTarget({
      index: today,
      now,
      range: '1m',
      view: 'total',
      names: { maybank: 'Maybank' },
      currency: 'MYR',
    });
    expect([single.from, single.to, single.count]).toEqual([0, 0, 1]);
    expect(single.ticks).toEqual([]);
  });

  it('leaves a later wallet empty before the day it began', () => {
    const later = balanceIndex({
      now,
      wallets: [
        { id: 'maybank', balanceMinor: 100000, createdAt: old },
        { id: 'cash', balanceMinor: 5000, createdAt: on(10, 13) },
      ],
      transactions: [],
    });
    const { from, to } = netWorthTarget({
      index: later,
      now,
      range: '1m',
      view: 'by-wallet',
      names: { maybank: 'Maybank', cash: 'Cash' },
      currency: 'MYR',
    });
    expect(Array.from(later.byWallet.cash!.subarray(from, to + 1))).toEqual([
      ...Array.from({ length: 12 }, () => NaN),
      5000,
      5000,
    ]);
  });
});

describe('walletLineStyles', () => {
  it('uses a deeper step of the wallet colour and patterns wallets that share one', () => {
    expect(
      walletLineStyles(
        [
          { id: 'a', cardStyleId: 'citrus-pop', type: 'bank' },
          { id: 'b', cardStyleId: null, type: 'bank' },
          { id: 'c', cardStyleId: 'emerald-grain', type: 'cash' },
        ],
        false,
      ),
    ).toEqual({
      a: { color: '#858000', dash: undefined },
      b: { color: '#858000', dash: '7 5' },
      c: { color: '#0B6B2A', dash: undefined },
    });
    expect(
      walletLineStyles(
        [{ id: 'c', cardStyleId: 'emerald-grain', type: 'cash' }],
        true,
      ).c,
    ).toEqual({ color: '#29AB68', dash: undefined });
  });
});
