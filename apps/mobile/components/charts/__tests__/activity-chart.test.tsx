import { render, screen } from '@testing-library/react-native';

import { ActivityChart } from '@/components/charts/activity-chart';

jest.mock('@/lib/haptics', () => ({ scrubStep: jest.fn() }));
jest.mock('uniwind', () => ({
  useCSSVariable: (names: string[]) => names.map(() => undefined),
}));

function chart(dayCount: number) {
  const days = Array.from({ length: dayCount }, (_, index) => ({
    key: `2026-11-${String(index + 1).padStart(2, '0')}`,
    spentMinor: 1320,
  }));
  return (
    <ActivityChart
      mode="spending"
      onModeChange={jest.fn()}
      spending={{
        days,
        spentMinor: 1320 * dayCount,
        inMinor: 0,
        lastMonthByNowMinor: 0,
        evenPaceMinor: 6000,
        safeToSpendMinor: 5100,
      } as never}
      balance={{ days: [] } as never}
      currency="MYR"
      selectedDay={null}
      onSelectDay={jest.fn()}
      now={new Date(2026, 10, dayCount, 18, 0)}
    />
  );
}

describe('ActivityChart axis labels', () => {
  it('on the 1st drops the month start under Today and the scale under the even pace', () => {
    render(chart(1));
    expect(screen.queryByText('1 Nov')).toBeNull();
    expect(screen.getByText('RM60')).toBeTruthy();
    expect(screen.queryByText('RM65')).toBeNull();
  });

  it('keeps the month start once Today has moved clear of it', () => {
    render(chart(14));
    expect(screen.getByText('1 Nov')).toBeTruthy();
    expect(screen.getAllByText('Today')).toHaveLength(2);
  });
});
