import type { MinorAmount } from '@repo/types';
import {
  fireEvent,
  render,
  screen,
} from '@testing-library/react-native';

import { NetWorthChart } from '@/components/wallets/net-worth-chart';
import {
  netWorthGeometry,
  walletLineStyles,
} from '@/components/wallets/net-worth-geometry';
import { balanceHistory } from '@/lib/finance/balance-history';
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
  it('shows the live number, thirty days by default, and a total callout on today', () => {
    chart([maybank, cash]);
    expect(
      screen.getByTestId('wallet.list.net-worth'),
    ).toHaveTextContent('RM2,500.00');
    expect(
      screen.getByTestId('wallet.chart.callout'),
    ).toHaveTextContent('RM2,500.00');
    expect(screen.getByText('15 Sep')).toHaveTextContent('15 Sep');
    expect(screen.getAllByText('Today')).toHaveLength(2);
    expect(
      screen.getByTestId('wallet.chart.30d').props.accessibilityState
        .selected,
    ).toBe(true);
    expect(screen.queryByTestId('wallet.chart.key')).toBeNull();
    expect(screen.queryByText(/closing balance each day/)).toBeNull();
  });

  it('relabels the axis when a range chip is pressed', () => {
    chart([maybank, cash]);
    fireEvent.press(screen.getByTestId('wallet.chart.1y'));
    expect(
      screen.getByTestId('wallet.chart.1y').props.accessibilityState
        .selected,
    ).toBe(true);
    expect(screen.getByText('Oct 2025')).toHaveTextContent(
      'Oct 2025',
    );
    expect(screen.queryByText('15 Sep')).toBeNull();
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

describe('netWorthGeometry', () => {
  const history = (range: '1y' | '1m') =>
    balanceHistory({
      now,
      range,
      wallets: [
        { id: 'maybank', balanceMinor: 243180, createdAt: old },
      ],
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
  const layout = (
    input: ReturnType<typeof balanceHistory>,
    view: 'total' | 'by-wallet' = 'total',
  ) =>
    netWorthGeometry({
      history: input,
      view,
      names: { maybank: 'Maybank' },
      width: 314,
      currency: 'MYR',
    });

  it('puts the first day on the left edge and today on the right on the 14th, not half way', () => {
    const { lines, left, right, step } = layout(history('1m'));
    const xs = lines[0]!.points
      .split(' ')
      .map((point) => Number(point.split(',')[0]));
    expect(xs).toHaveLength(14);
    expect(xs[0]).toBe(54);
    expect(xs[13]).toBe(310);
    expect([left, right]).toEqual([54, 310]);
    expect(step).toBeCloseTo(256 / 13);
  });

  it('starts the axis near the lowest balance and says so', () => {
    const { axis, accessibilityLabel } = layout(history('1m'));
    expect(axis.map((label) => label.text)).toEqual([
      'RM3,500',
      'RM2,750',
      'RM2,000',
    ]);
    expect(accessibilityLabel).toBe(
      'Net worth, 1 Oct to today, from RM3,185.50 to RM2,431.80. The axis starts at RM2,000, not zero.',
    );
  });

  it('labels a year by month and keeps the last point exact', () => {
    const year = history('1y');
    const { ticks, lines } = layout(year);
    expect(ticks.map((tick) => tick.text)).toEqual([
      'Oct 2025',
      'Apr 2026',
      'Today',
    ]);
    expect(lines[0]!.points.split(' ')).toHaveLength(366);
    expect(year.total[365]).toBe(243180);
  });

  it('spans the plot with a single day', () => {
    const { lines, ticks, area, step } = layout(
      balanceHistory({
        now,
        range: '1m',
        wallets: [
          {
            id: 'maybank',
            balanceMinor: 243180,
            createdAt: on(10, 14),
          },
        ],
        transactions: [],
      }),
    );
    expect(
      lines[0]!.points.split(' ').map((point) => point.split(',')[0]),
    ).toEqual(['54', '310']);
    expect(ticks.map((tick) => tick.text)).toEqual(['Today']);
    expect(step).toBe(0);
    expect(area).toContain('L310,');
  });

  it('draws a later wallet only from the day it began', () => {
    const later = balanceHistory({
      now,
      range: '1m',
      wallets: [
        { id: 'maybank', balanceMinor: 100000, createdAt: old },
        { id: 'cash', balanceMinor: 5000, createdAt: on(10, 13) },
      ],
      transactions: [],
    });
    const { lines } = netWorthGeometry({
      history: later,
      view: 'by-wallet',
      names: { maybank: 'Maybank', cash: 'Cash' },
      width: 314,
      currency: 'MYR',
    });
    expect(
      lines.map((line) => line.points.split(' ').length),
    ).toEqual([14, 2]);
    expect(lines[1]!.ys.slice(0, 12).every((y) => y === null)).toBe(
      true,
    );
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
