import type { MinorAmount } from '@repo/types';
import {
  act,
  fireEvent,
  render,
  screen,
} from '@testing-library/react-native';

import { finger } from '@/components/charts/__tests__/scrub-fixture';
import { NetWorthChart } from '@/components/wallets/net-worth-chart';
import {
  netWorthScrubPoints,
  netWorthTarget,
  walletLineStyles,
} from '@/components/wallets/net-worth-geometry';
import { balanceIndex } from '@/lib/finance/balance-history';
import { lightThemeTokens } from '@/constants/theme-tokens.generated';
import { CHART_RANGES } from '@/lib/finance/chart-range';
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

/** Maybank spends RM40 on 10 Oct, and both wallets spend on 12 Oct: two days with changes. */
const moves = [
  expense('grab', on(10, 10), { amountMinor: money(4000) }),
  expense('kopi', on(10, 12), { amountMinor: money(1000) }),
  expense('nasi', on(10, 12), { walletId: 'cash', amountMinor: money(500) }),
];

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
  beforeEach(() => jest.clearAllMocks());

  it('shows the live number and thirty days by default, with no callout at rest', () => {
    chart([maybank, cash]);
    expect(
      screen.getByTestId('wallet.list.net-worth'),
    ).toHaveTextContent('RM2,500.00');
    expect(screen.queryByTestId('wallet.chart.callout')).toBeNull();
    for (const monday of ['21 Sep', '28 Sep', '5 Oct', '12 Oct'])
      expect(screen.getByText(monday)).toBeTruthy();
    expect(screen.getAllByText('Today')).toHaveLength(1);
    expect(
      screen.getByTestId('wallet.chart.30d').props.accessibilityState
        .selected,
    ).toBe(true);
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

  it('shows the callout while a finger is down, moving day by day and ticking on days a transaction moved a balance', async () => {
    chart([maybank, cash], moves);
    const touch = finger('wallet.chart');
    // 30 days over 256 px, about 8.8 px a day: 10 Oct at x 275, 12 Oct at 292, 13 Oct at 301, today at 310.
    await touch.down(275);
    expect(screen.getByText('Sat 10 Oct')).toBeTruthy();
    expect(screen.getByTestId('wallet.chart.callout')).toHaveTextContent('RM2,410.00');
    await touch.drag(275);
    await touch.move(284);
    expect(screen.getByText('Sun 11 Oct')).toBeTruthy();
    expect(screen.getByTestId('wallet.chart.callout')).toHaveTextContent('RM2,410.00');
    await touch.move(292);
    expect(screen.getByText('Mon 12 Oct')).toBeTruthy();
    expect(screen.getByTestId('wallet.chart.callout')).toHaveTextContent('RM2,500.00');
    await touch.move(301);
    expect(screen.getByText('Yesterday')).toBeTruthy();
    expect(screen.getByTestId('wallet.chart.callout')).toHaveTextContent('RM2,500.00');
    // The landing, then 12 Oct; 11 and 13 Oct had no transactions, so no tick.
    expect(jest.mocked(chartStep).mock.calls).toEqual([[false], [false]]);
    await touch.up(300);
    expect(screen.queryByTestId('wallet.chart.callout')).toBeNull();
    await touch.down(300);
    await touch.scroll(300);
    expect(screen.queryByTestId('wallet.chart.callout')).toBeNull();
    expect(chartStep).toHaveBeenCalledTimes(3);
  });

  for (const { value: range } of CHART_RANGES)
    it(`ticks once on touch and once per new point on ${range}`, async () => {
      chart([maybank, cash], moves);
      fireEvent.press(screen.getByTestId(`wallet.chart.${range}`));
      const touch = finger('wallet.chart');
      await touch.down(54);
      await touch.drag(54);
      await touch.move(310);
      expect(chartStep).toHaveBeenCalledTimes(2);
    });

  it('draws By wallet in each wallet list tint with no key, and reads the day a screen reader picks', () => {
    chart([maybank, cash], moves);
    fireEvent.press(screen.getByTestId('wallet.chart.by-wallet'));

    expect(screen.queryByTestId('wallet.chart.key')).toBeNull();
    const strokes = screen.UNSAFE_root.findAll(
      (node) => node.props.strokeWidth === 3.5 && typeof node.props.stroke === 'string',
    ).map((node) => node.props.stroke);
    expect(new Set(strokes)).toEqual(new Set([lightThemeTokens.lemon, lightThemeTokens.mint]));

    const plot = screen.getByTestId('wallet.chart.plot');
    expect(plot.props.accessibilityValue.text).toBe(
      'Today, Maybank RM2,400.00, Cash RM100.00',
    );

    const back = { nativeEvent: { actionName: 'decrement' } };
    for (let times = 0; times < 2; times++)
      fireEvent(plot, 'accessibilityAction', back);
    expect(plot.props.accessibilityValue.text).toBe(
      'Sat 10 Oct, Maybank RM2,410.00, Cash not yet',
    );
    expect(screen.queryByTestId('wallet.chart.callout')).toBeNull();
    expect(
      screen.getByTestId('wallet.list.net-worth'),
    ).toHaveTextContent('RM2,500.00');
  });

  it('returns the spoken day to today when the range changes', () => {
    chart([maybank, cash], moves);
    const plot = screen.getByTestId('wallet.chart.plot');
    fireEvent(plot, 'accessibilityAction', {
      nativeEvent: { actionName: 'decrement' },
    });
    expect(plot.props.accessibilityValue.text).toBe(
      'Mon 12 Oct, RM2,500.00',
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
    const { from, to, points } = target('1m');
    expect(to).toBe(index.days - 1);
    expect(to - from).toBe(13);
    expect(Array.from(points.ids)).toEqual(Array.from({ length: 14 }, (_, k) => from + k));
    expect(Array.from(points.at)).toEqual(Array.from(points.ids));
    expect(Array.from(points.ids).filter((_, i) => points.marks[i] === 1)).toEqual([to - 4]);
  });

  it('starts the axis near the lowest balance and says so', () => {
    const { axis, low, high, accessibilityLabel } = target('1m');
    expect([low, high]).toEqual([200000, 350000]);
    expect(axis).toEqual([
      { value: 350000, text: 'RM3,500', line: 'solid' },
      { value: 275000, text: 'RM2,750', line: 'dashed' },
      { value: 200000, text: 'RM2,000', line: 'solid' },
    ]);
    expect(accessibilityLabel).toBe(
      'Net worth, 1 Oct to today, from RM3,185.50 to RM2,431.80. The axis starts at RM2,000, not zero.',
    );
  });

  it('dates a year by quarter and keeps the last day exact', () => {
    const { ticks, from, to } = target('1y');
    expect(ticks.map((tick) => tick.label)).toEqual([
      'Jan 2026',
      'Apr',
      'Jul',
      'Oct',
    ]);
    expect(to - from).toBe(365);
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
    expect([single.from, single.to]).toEqual([0, 0]);
    expect(Array.from(single.points.ids)).toEqual([0]);
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

describe('netWorthScrubPoints', () => {
  it('stops on every day, and ticks once on each day a transaction moved a balance, however many moved it', () => {
    const index = balanceIndex({
      now,
      wallets: [
        { id: 'maybank', balanceMinor: 240000, createdAt: old },
        { id: 'cash', balanceMinor: 10000, createdAt: old },
      ],
      transactions: moves,
    });
    const today = index.days - 1;
    const { at, ids, marks } = netWorthScrubPoints(index, today - 29, today);
    expect(ids.length).toBe(30);
    expect(Array.from(at)).toEqual(Array.from(ids));
    expect(Array.from(ids).filter((_, i) => marks[i] === 1)).toEqual([today - 4, today - 2]);
    const short = netWorthScrubPoints(index, today - 3, today);
    expect(Array.from(short.ids)).toEqual([today - 3, today - 2, today - 1, today]);
    expect(Array.from(short.marks)).toEqual([0, 1, 0, 0]);
  });
});

describe('walletLineStyles', () => {
  const light = { sand: '#ece5d6', mint: '#a9ddb5', lemon: '#f2dc72', lilac: '#c9b6f0', peach: '#f5be98', coral: '#f1a399', sky: '#9fc4e8', aqua: '#9fdcd3' };

  it('draws each wallet in its list bubble tint and patterns wallets that share one', () => {
    expect(
      walletLineStyles(
        [
          { id: 'a', cardStyleId: 'citrus-pop', type: 'bank' },
          { id: 'b', cardStyleId: null, type: 'bank' },
          { id: 'c', cardStyleId: 'emerald-grain', type: 'cash' },
        ],
        light,
      ),
    ).toEqual({
      a: { color: '#f2dc72', dash: undefined },
      b: { color: '#f2dc72', dash: '7 5' },
      c: { color: '#a9ddb5', dash: undefined },
    });
  });
});
