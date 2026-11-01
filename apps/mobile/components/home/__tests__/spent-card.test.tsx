import {
  fireEvent,
  render,
  screen,
} from '@testing-library/react-native';

import { SpentCard } from '@/components/home/spent-card';
import type { BudgetMonth } from '@/lib/finance/budget-month';

jest.mock('@/lib/haptics', () => ({ scrubStep: jest.fn() }));
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

describe('SpentCard', () => {
  it('leaves the total to the chart and puts what is left under it', () => {
    render(
      <SpentCard
        month={month}
        currency="MYR"
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

  it('keeps the line in place when the toggle moves to Daily', () => {
    render(
      <SpentCard
        month={month}
        currency="MYR"
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
