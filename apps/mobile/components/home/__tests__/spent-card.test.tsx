import {
  act,
  fireEvent,
  render,
  screen,
} from '@testing-library/react-native';

import { finger } from '@/components/charts/__tests__/scrub-fixture';
import { SpentCard } from '@/components/home/spent-card';
import { CHART_RANGES } from '@/lib/finance/chart-range';
import type { FinanceTransaction } from '@/lib/finance/types';
import type { BudgetMonth } from '@/lib/finance/budget-month';
import { chartStep } from '@/lib/haptics';

jest.mock('@/lib/haptics', () => ({ scrubStep: jest.fn(), chartStep: jest.fn() }));
jest.mock('uniwind', () => ({
  useCSSVariable: (names: string[]) => names.map(() => undefined),
  useUniwind: () => ({ theme: 'light' }),
}));

// The chart reads 1M from the same transactions as the other ranges, so the month matches them.
const month = {
  month: '2026-10',
  daysInMonth: 31,
  throughDay: 14,
  daily: Array.from({ length: 31 }, (_, day) => (day === 9 ? 2500 : day === 13 ? 1000 : 0)),
  spentMinor: 3500,
  budgetMinor: 180000,
  left: {
    leftMinor: 31700,
    daysLeft: 18,
    perDayMinor: 1700,
    billsMinor: 0,
    debtsDue: [],
  },
} as unknown as BudgetMonth;

function rootOrder(): string[] {
  const seen: string[] = [];
  const walk = (node: unknown) => {
    if (typeof node !== 'object' || node === null) return;
    const { props, children } = node as {
      props: { testID?: string };
      children?: unknown[];
    };
    if (props.testID) seen.push(props.testID);
    children?.forEach(walk);
  };
  walk(screen.toJSON());
  return seen;
}

const NOW = new Date(2026, 9, 14, 12);
const spends = [
  { id: 'a', type: 'expense', currency: 'MYR', amountMinor: 1000, transactionDate: new Date(2026, 9, 14, 9).toISOString(), analysisExcluded: false, debtActivityId: null },
  { id: 'b', type: 'expense', currency: 'MYR', amountMinor: 2500, transactionDate: new Date(2026, 9, 10, 9).toISOString(), analysisExcluded: false, debtActivityId: null },
  { id: 'c', type: 'expense', currency: 'MYR', amountMinor: 4000, transactionDate: new Date(2026, 8, 20, 9).toISOString(), analysisExcluded: false, debtActivityId: null },
] as FinanceTransaction[];

/** The plot runs from x 54 to 310 at the default width; 310 is always today's point. */
const RIGHT = 310;

function card() {
  render(
    <SpentCard
      month={month}
      currency="MYR"
      transactions={spends}
      now={NOW}
    />,
  );
}

/** What the callout reads with a finger on the plot at `x`. */
async function readAt(x: number): Promise<string> {
  const touch = finger('home.chart');
  await touch.down(x);
  const value = screen.getByTestId('home.chart.callout').props.children as string;
  await touch.up(x);
  return value;
}

describe('SpentCard', () => {
  afterEach(() => jest.useRealTimers());
  beforeEach(() => jest.clearAllMocks());

  it('puts what is left under the chart and shows only marks at rest', () => {
    render(
      <SpentCard
        month={month}
        currency="MYR"
        transactions={spends}
        now={NOW}
      />,
    );
    expect(screen.getByText('Spent in October')).toBeTruthy();
    expect(screen.queryByText(/ of RM1,800/)).toBeNull();
    expect(screen.queryByText('RM35.00')).toBeNull();
    expect(screen.queryByTestId('home.chart.callout')).toBeNull();
    expect(screen.queryByText('By today')).toBeNull();
    expect(screen.getByTestId('home.chart.budget')).toHaveTextContent(
      'RM1,800',
    );
    expect(screen.getByTestId('home.spent.left')).toHaveTextContent(
      'RM317 left for 18 days · RM17 a day',
    );
    const order = rootOrder();
    expect(order.indexOf('home.spent.left')).toBeGreaterThan(
      order.indexOf('home.pace-chart'),
    );
  });

  it('offers the range chips, starting on the month with its budget', () => {
    render(
      <SpentCard
        month={month}
        currency="MYR"
        transactions={spends}
        now={NOW}
      />,
    );
    for (const [id, label] of [['1m', '1M'], ['7d', '7D'], ['30d', '30D'], ['90d', '90D'], ['1y', '1Y'], ['all', 'All']]) {
      expect(screen.getByTestId(`home.range.${id}`)).toHaveTextContent(label!);
    }
    expect(screen.getByTestId('home.range.1m').props.accessibilityState.selected).toBe(true);
  });

  it('dates the month on 1M and each weekday on 7D, with Today bold where today is', () => {
    jest.useFakeTimers();
    render(
      <SpentCard
        month={month}
        currency="MYR"
        transactions={spends}
        now={NOW}
      />,
    );
    for (const label of ['1 Oct', '8', '15', '22', '29', 'Today']) expect(screen.getByText(label)).toBeTruthy();
    fireEvent.press(screen.getByTestId('home.range.7d'));
    for (const label of ['Thu', 'Fri', 'Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Today'])
      expect(screen.getByText(label)).toBeTruthy();
    // The month's ticks slide out with the zoom as they fade, then go.
    expect(screen.getByText('1 Oct')).toBeTruthy();
    act(() => jest.advanceTimersByTime(150));
    expect(screen.queryByText('1 Oct')).toBeNull();
  });

  it('slides the new range y labels in while the old ones fade out on the moving scale', () => {
    jest.useFakeTimers();
    card();
    expect(screen.getByText('RM900')).toBeTruthy();
    fireEvent.press(screen.getByTestId('home.range.7d'));
    expect(screen.getByText('RM50')).toBeTruthy();
    expect(screen.getByText('RM900')).toBeTruthy();
    act(() => jest.advanceTimersByTime(150));
    expect(screen.queryByText('RM900')).toBeNull();
    expect(screen.getAllByText('RM0')).toHaveLength(1);
  });

  it('zooms the same chart between ranges instead of drawing a new one', () => {
    render(
      <SpentCard
        month={month}
        currency="MYR"
        transactions={spends}
        now={NOW}
      />,
    );
    const chart = screen.getByTestId('home.pace-chart');
    fireEvent.press(screen.getByTestId('home.range.7d'));
    fireEvent.press(screen.getByTestId('home.range.all'));
    fireEvent.press(screen.getByTestId('home.range.1m'));
    expect(screen.getByTestId('home.pace-chart')).toBe(chart);
  });

  it('shows the callout the moment a finger lands, moves day by day, ticks on days with spending, and goes on release', async () => {
    card();
    const touch = finger('home.chart');
    // 1M runs 31 days over 256 px, about 8.3 px a day: 1 Oct ends at x 62, 10 Oct at 137, today at 170.
    await touch.down(137);
    expect(screen.getByText('By Sat 10 Oct')).toBeTruthy();
    expect(screen.getByTestId('home.chart.callout')).toHaveTextContent('RM25.00');
    await touch.drag(137);
    await touch.move(145);
    expect(screen.getByText('By Sun 11 Oct')).toBeTruthy();
    expect(screen.getByTestId('home.chart.callout')).toHaveTextContent('RM25.00');
    await touch.move(62);
    expect(screen.getByText('By Thu 1 Oct')).toBeTruthy();
    expect(screen.getByTestId('home.chart.callout')).toHaveTextContent('RM0.00');
    await touch.move(170);
    expect(screen.getByText('By today')).toBeTruthy();
    // The landing, then passing 10 Oct on the way back to 1 Oct, then today; 11 Oct alone is quiet.
    expect(jest.mocked(chartStep).mock.calls).toEqual([[false], [false], [false]]);
    await touch.up(170);
    expect(screen.queryByTestId('home.chart.callout')).toBeNull();
  });

  it('shows the callout only while a tap is down, and once for a hold that then moves any way', async () => {
    card();
    const touch = finger('home.chart');
    await touch.down(140);
    await touch.up(140);
    expect(screen.queryByTestId('home.chart.callout')).toBeNull();
    await touch.down(140);
    await touch.hold(140);
    expect(screen.getByText('By Sat 10 Oct')).toBeTruthy();
    await touch.move(170);
    expect(screen.getByText('By today')).toBeTruthy();
    await touch.up(170);
    expect(screen.queryByTestId('home.chart.callout')).toBeNull();
    expect(chartStep).toHaveBeenCalledTimes(3);
  });

  it('hides the callout without a tick when the finger scrolls the page instead', async () => {
    card();
    const touch = finger('home.chart');
    await touch.down(140);
    await touch.scroll(140);
    expect(screen.queryByTestId('home.chart.callout')).toBeNull();
    expect(chartStep).toHaveBeenCalledTimes(1);
  });

  for (const mode of ['pace', 'daily'] as const)
    for (const { value: range } of CHART_RANGES)
      it(`ticks once on touch and once per new point on ${range} ${mode}`, async () => {
        card();
        if (mode === 'daily') fireEvent.press(screen.getByTestId('home.chart.daily'));
        fireEvent.press(screen.getByTestId(`home.range.${range}`));
        const touch = finger('home.chart');
        await touch.down(54);
        await touch.drag(54);
        await touch.move(RIGHT);
        await touch.up(RIGHT);
        expect(chartStep).toHaveBeenCalledTimes(2);
      });

  it('plays the frequent tick between points closer than 8 px', async () => {
    card();
    fireEvent.press(screen.getByTestId('home.range.1y'));
    const touch = finger('home.chart');
    // A year over 256 px: 10 Oct and today sit 2.8 px apart at the right edge.
    await touch.down(307);
    await touch.drag(307);
    await touch.move(RIGHT);
    expect(jest.mocked(chartStep).mock.calls).toEqual([[false], [true]]);
  });

  it('labels the even pace on 1M Daily and drops it on other ranges', async () => {
    render(
      <SpentCard
        month={month}
        currency="MYR"
        transactions={spends}
        now={NOW}
      />,
    );
    fireEvent.press(screen.getByTestId('home.chart.daily'));
    expect(screen.getByTestId('home.chart.even-pace')).toHaveTextContent('RM58');
    expect(await readAt(RIGHT)).toBe('RM10.00');
    fireEvent.press(screen.getByTestId('home.range.30d'));
    expect(screen.queryByTestId('home.chart.even-pace')).toBeNull();
  });

  it('adds up the chosen range on Pace, without the budget or what is left', async () => {
    render(
      <SpentCard
        month={month}
        currency="MYR"
        transactions={spends}
        now={NOW}
      />,
    );
    fireEvent.press(screen.getByTestId('home.range.7d'));
    expect(screen.getByText('Spent in the last 7 days')).toBeTruthy();
    expect(await readAt(RIGHT)).toBe('RM35.00');
    expect(screen.queryByTestId('home.chart.budget')).toBeNull();
    expect(screen.queryByTestId('home.spent.left')).toBeNull();

    fireEvent.press(screen.getByTestId('home.range.30d'));
    expect(await readAt(RIGHT)).toBe('RM75.00');
  });

  it('shows the last bar on Daily over a range, and returns to the month on 1M', async () => {
    render(
      <SpentCard
        month={month}
        currency="MYR"
        transactions={spends}
        now={NOW}
      />,
    );
    fireEvent.press(screen.getByTestId('home.chart.daily'));
    fireEvent.press(screen.getByTestId('home.range.7d'));
    expect(await readAt(RIGHT)).toBe('RM10.00');
    fireEvent.press(screen.getByTestId('home.range.1m'));
    expect(screen.getByText('Spent in October')).toBeTruthy();
    expect(screen.getByTestId('home.spent.left')).toBeTruthy();
  });

  it('hides the chips before anything was ever spent', () => {
    render(
      <SpentCard
        month={month}
        currency="MYR"
        transactions={[]}
        now={NOW}
      />,
    );
    expect(screen.queryByTestId('home.range.1m')).toBeNull();
  });

  it('keeps the line in place when the toggle moves to Daily', () => {
    render(
      <SpentCard
        month={month}
        currency="MYR"
        transactions={spends}
        now={NOW}
      />,
    );
    fireEvent.press(screen.getByTestId('home.chart.daily'));
    expect(screen.getByTestId('home.spent.left')).toHaveTextContent(
      'RM317 left for 18 days · RM17 a day',
    );
    const order = rootOrder();
    expect(order.indexOf('home.spent.left')).toBeGreaterThan(
      order.indexOf('home.pace-chart'),
    );
  });
});
