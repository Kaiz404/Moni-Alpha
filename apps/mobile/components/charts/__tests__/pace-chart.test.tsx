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
  it('draws no legend or hint in either mode', () => {
    const chart = (mode: 'pace' | 'daily') => (
      <PaceChart
        screen="home"
        mode={mode}
        series={{ month: october, values: spend }}
        budget={budget}
        currency="MYR"
        safePerDay={2461}
      />
    );
    const gone = ['Spent', 'Even pace', 'Tap or drag', 'Tap a bar', 'Over even pace', 'Safe to spend a day'];
    const hidden = { includeHiddenElements: true };
    const { rerender } = render(chart('pace'));
    for (const text of gone) expect(screen.queryByText(text, hidden)).toBeNull();
    rerender(chart('daily'));
    for (const text of gone) expect(screen.queryByText(text, hidden)).toBeNull();
  });

  it('keeps the budget as the top line while spending is under it, and hides a scale that would overprint it', () => {
    const pace = (values: number[]) =>
      paceGeometry({
        mode: 'pace',
        width: 314,
        series: { month: october, values },
        budget,
        currency: 'MYR',
      } as never).labels.map((label) => label.text);
    expect(pace([122390])).toEqual(['RM1,800', 'RM900', 'RM0']);
    expect(pace([181000])).toEqual(['RM1,800', 'RM0']);
  });

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
      series: { month: october, values: [250000, 50000] },
      budget,
      currency: 'MYR',
      width: 314,
    });
    expect(geometry.labels.map((label) => label.text)).toEqual([
      'RM5,000',
      'RM1,800',
      'RM0',
    ]);
  });
});
