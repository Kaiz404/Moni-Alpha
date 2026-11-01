import {
  fireEvent,
  render,
  screen,
} from '@testing-library/react-native';

import { SpentCard } from '@/components/home/spent-card';
import type { FinanceTransaction } from '@/lib/finance/types';
import type { BudgetMonth } from '@/lib/finance/budget-month';

jest.mock('@/lib/haptics', () => ({ scrubStep: jest.fn(), chartStep: jest.fn() }));
jest.mock('uniwind', () => ({
  useCSSVariable: (names: string[]) => names.map(() => undefined),
  useUniwind: () => ({ theme: 'light' }),
}));

const month = {
  month: '2026-10',
  daysInMonth: 31,
  throughDay: 2,
  daily: [50000, 74130, ...Array.from({ length: 29 }, () => 0)],
  spentMinor: 124130,
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

describe('SpentCard', () => {
  it('leaves the total to the chart and puts what is left under it', () => {
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
    expect(screen.getAllByText('RM1,241.30')).toHaveLength(1);
    expect(screen.getByTestId('home.chart.callout')).toHaveTextContent(
      'RM1,241.30',
    );
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

  it('adds up the chosen range on Pace, without the budget or what is left', () => {
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
    expect(screen.getByTestId('home.chart.callout')).toHaveTextContent('RM35.00');
    expect(screen.queryByTestId('home.chart.budget')).toBeNull();
    expect(screen.queryByTestId('home.spent.left')).toBeNull();

    fireEvent.press(screen.getByTestId('home.range.30d'));
    expect(screen.getByTestId('home.chart.callout')).toHaveTextContent('RM75.00');
  });

  it('shows the last bar on Daily over a range, and returns to the month on 1M', () => {
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
    expect(screen.getByTestId('home.chart.callout')).toHaveTextContent('RM10.00');
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
