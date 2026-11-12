import type { MinorAmount } from '@repo/types';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { State } from 'react-native-gesture-handler';
import {
  fireGestureHandler,
  getByGestureTestId,
} from 'react-native-gesture-handler/jest-utils';

import { shareOfSpending, SpendRing } from '@/components/budget/spend-ring';
import type { SpendSlice } from '@/lib/finance/budget-month';
import { scrubStep } from '@/lib/haptics';

jest.mock('@/lib/haptics', () => ({ scrubStep: jest.fn() }));
jest.mock('uniwind', () => ({
  useCSSVariable: (names: string[]) => names.map(() => undefined),
  useUniwind: () => ({ theme: 'light' }),
}));

const slice = (name: string, ringgit: number, color: string | null = '#FB7F77'): SpendSlice => ({
  categoryId: name.toLowerCase(),
  name,
  icon: 'car',
  color,
  spentMinor: Math.round(ringgit * 100) as MinorAmount,
});

const seed = [
  slice('Transportation', 140),
  slice('Food & Dining', 349.8),
  slice('Groceries', 235.3),
  slice('Shopping', 149.3),
  slice('Housing', 96.5),
  slice('Gifts', 45),
  slice('Healthcare', 40.5),
  slice('Entertainment', 38),
  slice('Subscriptions', 21.8),
];

function renderRing({
  slices = seed,
  total = 111620,
  budget = 180000,
  month = '2026-10',
}: {
  slices?: SpendSlice[];
  total?: number;
  budget?: number | null;
  month?: string;
} = {}) {
  return (
    <SpendRing
      slices={slices}
      totalMinor={total as MinorAmount}
      budgetMinor={budget as MinorAmount | null}
      currency="MYR"
      month={month}
      monthName="October"
    />
  );
}

const activate = (id: string) =>
  fireEvent(screen.getByTestId(id), 'accessibilityAction', {
    nativeEvent: { actionName: 'activate' },
  });

const tapAt = (x: number, y: number) =>
  act(async () => {
    fireGestureHandler(getByGestureTestId('budget.spend-ring.tap'), [
      { state: State.BEGAN, x, y },
      { state: State.ACTIVE, x, y },
      { state: State.END, x, y },
    ]);
  });

describe('SpendRing', () => {
  beforeEach(() => jest.mocked(scrubStep).mockClear());

  it('leads with the month total and the budget', () => {
    render(renderRing());
    expect(screen.getByTestId('budget.spend-ring.total')).toHaveTextContent('RM1,116.20');
    expect(screen.getByText('of RM1,800')).toBeTruthy();
    expect(screen.getByLabelText('Spent in October, RM1,116.20 of RM1,800')).toBeTruthy();
  });

  it('says spent with no budget', () => {
    render(renderRing({ budget: null }));
    expect(screen.getByText('spent')).toBeTruthy();
    expect(screen.queryByText(/^of /)).toBeNull();
  });

  it('says what is over, in the words of the rule, with the arcs still drawn', () => {
    render(renderRing({ total: 191620 }));
    expect(screen.getByTestId('budget.spend-ring.total')).toHaveTextContent('RM1,916.20');
    expect(screen.getByText('RM116 over')).toBeTruthy();
    expect(screen.queryByText('of RM1,800')).toBeNull();
    expect(screen.getByTestId('budget.slice.food-dining')).toBeTruthy();
  });

  it('shows RM0 on an empty ring, with nothing to tap', async () => {
    render(renderRing({ slices: [], total: 0 }));
    expect(screen.getByTestId('budget.spend-ring.total')).toHaveTextContent('RM0');
    expect(screen.queryByTestId(/^budget\.slice\./)).toBeNull();
    await tapAt(142, 18);
    expect(scrubStep).not.toHaveBeenCalled();
  });

  it('reads an arc in the middle, then goes back to the total when it is tapped again', () => {
    render(renderRing());
    activate('budget.slice.food-dining');
    expect(screen.getByTestId('budget.spend-ring.selected')).toHaveTextContent(
      'RM349.80Food & Dining31% of spending',
    );
    expect(screen.queryByTestId('budget.spend-ring.total')).toBeNull();
    expect(scrubStep).toHaveBeenCalledTimes(1);

    activate('budget.slice.food-dining');
    expect(screen.getByTestId('budget.spend-ring.total')).toHaveTextContent('RM1,116.20');
    expect(scrubStep).toHaveBeenCalledTimes(2);
  });

  it('hits an arc anywhere along it, the middle goes back, and a miss does nothing', async () => {
    render(renderRing());
    // The biggest arc starts near 12 o'clock, so 2 o'clock is on it, well off its icon's centre.
    const angle = Math.PI / 3;
    const onBiggest = [142 + 124 * Math.sin(angle), 142 - 124 * Math.cos(angle)] as const;
    await tapAt(...onBiggest);
    expect(screen.getByTestId('budget.spend-ring.selected')).toHaveTextContent('RM349.80Food & Dining31% of spending');

    await tapAt(0, 0);
    expect(screen.getByTestId('budget.spend-ring.selected')).toHaveTextContent('RM349.80Food & Dining31% of spending');
    expect(scrubStep).toHaveBeenCalledTimes(1);

    await tapAt(142, 142);
    expect(screen.getByTestId('budget.spend-ring.total')).toBeTruthy();
    expect(scrubStep).toHaveBeenCalledTimes(2);

    await tapAt(142, 142);
    expect(scrubStep).toHaveBeenCalledTimes(2);
  });

  it('folds the smallest categories into Other past eight, and says how many', () => {
    render(renderRing());
    expect(screen.queryByTestId('budget.slice.entertainment')).toBeNull();
    expect(screen.queryByTestId('budget.slice.subscriptions')).toBeNull();
    expect(screen.getByLabelText('Other, Entertainment, Subscriptions, RM59.80, 5% of spending')).toBeTruthy();

    activate('budget.slice.other');
    expect(screen.getByTestId('budget.spend-ring.selected')).toHaveTextContent(
      'RM59.80Other2 categories · 5%',
    );
  });

  it('labels spending with no category', () => {
    render(
      renderRing({
        slices: [{ ...slice('No category', 20, null), categoryId: null, icon: null }],
        total: 2000,
      }),
    );
    expect(screen.getByLabelText('No category, RM20.00, 100% of spending')).toBeTruthy();
  });

  it('goes back to the total when the month changes', () => {
    const { rerender } = render(renderRing());
    activate('budget.slice.food-dining');
    rerender(renderRing({ month: '2026-09', slices: [slice('Food & Dining', 10)], total: 1000 }));
    expect(screen.getByTestId('budget.spend-ring.total')).toHaveTextContent('RM10.00');
    expect(screen.queryByTestId('budget.spend-ring.selected')).toBeNull();
  });

  it('drops an arc from the touch and screen reader tree as soon as its month is gone', () => {
    const { rerender } = render(renderRing());
    expect(screen.getByTestId('budget.slice.housing')).toBeTruthy();
    rerender(renderRing({ month: '2026-09', slices: [slice('Transportation', 140)], total: 14000 }));
    expect(screen.queryByTestId('budget.slice.housing')).toBeNull();
    expect(screen.getByTestId('budget.slice.transportation')).toBeTruthy();
  });
});

describe('shareOfSpending', () => {
  it.each([
    [1, '100% of spending'],
    [0.313, '31% of spending'],
    [0.002, 'Under 1% of spending'],
    [0.996, 'Over 99% of spending'],
  ])('%s reads %s', (share, words) => {
    expect(shareOfSpending(share)).toBe(words);
  });
});
