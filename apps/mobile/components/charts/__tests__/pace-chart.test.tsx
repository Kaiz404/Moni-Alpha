import {
  fireEvent,
  render,
  screen,
} from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { PaceChart } from '@/components/charts/pace-chart';
import { paceGeometry } from '@/components/charts/pace-geometry';
import { scrubStep } from '@/lib/haptics';

jest.mock('@/lib/haptics', () => ({ scrubStep: jest.fn() }));
jest.mock('uniwind', () => ({
  useCSSVariable: (names: string[]) => names.map(() => undefined),
}));

const october = { year: 2026, month: 9 };
// The V2H-Home sample: RM1,116.20 spent over 1 to 14 October.
const spend = [
  1250, 7890, 12930, 12735, 7100, 13970, 9030, 7220, 4200, 15960, 7815, 4020,
  6180, 1320,
];
const budget = 180000;

describe('PaceChart', () => {
  it('labels the even pace RM58 for a RM1,800 month and draws no projection line', () => {
    render(
      <PaceChart
        screen="home"
        mode="daily"
        series={{ month: october, values: spend }}
        budget={budget}
        currency="MYR"
        safePerDay={2461}
      />,
    );
    expect(screen.getByTestId('home.chart.even-pace')).toHaveTextContent(
      'RM58',
    );
    expect(screen.getByTestId('home.chart.callout')).toHaveTextContent(
      'RM13.20',
    );
    expect(screen.queryByTestId('home.chart.projection')).toBeNull();
  });

  it('puts the budget on the top gridline and scrubs back one day with a tick', () => {
    render(
      <PaceChart
        screen="home"
        mode="pace"
        series={{ month: october, values: spend }}
        budget={budget}
        currency="MYR"
      />,
    );
    expect(screen.getByTestId('home.chart.budget')).toHaveTextContent(
      'RM1,800',
    );
    expect(screen.getByText('By today')).toBeTruthy();
    expect(screen.getByTestId('home.chart.callout')).toHaveTextContent(
      'RM1,116.20',
    );

    fireEvent(screen.getByTestId('home.chart.plot'), 'accessibilityAction', {
      nativeEvent: { actionName: 'decrement' },
    });
    expect(screen.getByText('By Tue 13 Oct')).toBeTruthy();
    expect(screen.getByTestId('home.chart.callout')).toHaveTextContent(
      'RM1,103.00',
    );
    expect(scrubStep).toHaveBeenCalledTimes(1);
  });

  it('pins the month ends of a line chart to the plot edges and centres Today', () => {
    render(
      <PaceChart
        screen="home"
        mode="pace"
        series={{ month: october, values: spend }}
        budget={budget}
        currency="MYR"
      />,
    );
    expect(screen.getByText('1 Oct')).toHaveStyle({ left: 50 });
    expect(screen.getByText('31 Oct')).toHaveStyle({ right: 0 });
    const today = screen.getByText('Today');
    expect(StyleSheet.flatten(today.props.style).left).toBeCloseTo(139.6, 1);
  });
});

describe('paceGeometry', () => {
  it('starts the balance axis near the lowest balance, not at zero', () => {
    const geometry = paceGeometry({
      mode: 'balance',
      series: { month: october, values: [318550, 290000, 243180] },
      budget: null,
      currency: 'MYR',
      width: 314,
    });
    expect(geometry.labels.map((label) => label.text)).toEqual([
      'RM3,200',
      'RM2,800',
      'RM2,400',
    ]);
    expect(geometry.accessibilityLabel).toBe(
      'Closing balance, 1 to 3 October, from RM3,185.50 to RM2,431.80. The axis starts at RM2,400, not zero.',
    );
  });

  it('ends a past month on its last day instead of today', () => {
    const geometry = paceGeometry({
      mode: 'pace',
      series: { month: { year: 2026, month: 8 }, values: Array.from({ length: 30 }, () => 1000) },
      budget,
      currency: 'MYR',
      width: 314,
      endsToday: false,
    });
    expect(geometry.ticks.map((tick) => tick.text)).toEqual(['1 Sep', '30 Sep']);
    expect(geometry.points.at(-1)?.date).toBe('By Wed 30 Sep');
  });

  it('raises the top of the pace axis above the budget once spending passes it', () => {
    const geometry = paceGeometry({
      mode: 'pace',
      series: { month: october, values: [150000, 50000] },
      budget,
      currency: 'MYR',
      width: 314,
    });
    expect(geometry.labels.map((label) => label.text)).toEqual([
      'RM2,000',
      'RM1,800',
      'RM0',
    ]);
  });
});
