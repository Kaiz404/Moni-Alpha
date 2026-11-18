import { render, screen } from '@testing-library/react-native';

import { CaughtUp, NothingToReview } from '@/components/review/caught-up';

jest.mock('uniwind', () => ({
  useCSSVariable: (names: string[]) => names.map(() => undefined),
  useUniwind: () => ({ theme: 'light' }),
}));
jest.mock('@/components/budget/use-budget', () => ({
  useBudgetData: () => ({ currency: 'MYR', now: new Date(2026, 9, 13) }),
  useBudgetMonth: () => ({ left: { leftMinor: 42000, daysLeft: 18, perDayMinor: 2300 } }),
}));

describe('CaughtUp', () => {
  it('shows safe to spend a day before and after around an arrow icon, read as "to"', () => {
    render(
      <CaughtUp
        sentence="1 approved."
        addedMinor={1200}
        onCaptureLog={() => {}}
      />,
    );
    expect(screen.getByText('RM24')).toBeTruthy();
    expect(screen.getByText('RM23')).toBeTruthy();
    expect(screen.queryByText(/→/)).toBeNull();
    expect(screen.getByLabelText('RM24 to RM23')).toBeTruthy();
    expect(screen.getByText('RM420 left for 18 days after these.')).toBeTruthy();
  });

  it('leads with the celebrating cat', () => {
    render(
      <CaughtUp
        sentence="1 approved."
        addedMinor={0}
        onCaptureLog={() => {}}
      />,
    );
    expect(screen.getByLabelText('Moni, celebrate')).toBeTruthy();
  });
});

describe('NothingToReview', () => {
  it('leads with the happy cat', () => {
    render(<NothingToReview onCaptureLog={() => {}} />);
    expect(screen.getByText('Nothing to review')).toBeTruthy();
    expect(screen.getByLabelText('Moni, happy')).toBeTruthy();
  });
});
