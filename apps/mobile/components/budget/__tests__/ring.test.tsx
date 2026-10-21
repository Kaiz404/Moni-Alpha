import type { MinorAmount } from '@repo/types';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { Ring } from '@/components/budget/ring';

jest.mock('uniwind', () => ({
  useCSSVariable: (names: string[]) => names.map(() => undefined),
  useUniwind: () => ({ theme: 'light' }),
}));

const sen = (ringgit: number) => (ringgit * 100) as MinorAmount;

function renderRing(spent: number, budget: number | null) {
  const onPress = jest.fn();
  render(
    <Ring
      testID="budget.ring.transport"
      name="Transport"
      icon="car"
      color="#9FC4E8"
      spentMinor={sen(spent)}
      budgetMinor={budget === null ? null : sen(budget)}
      currency="MYR"
      onPress={onPress}
    />,
  );
  return { ring: screen.getByTestId('budget.ring.transport'), onPress };
}

describe('Ring', () => {
  it('says RM20 over and sweeps the whole ring when RM140 is spent of RM120', () => {
    const { ring, onPress } = renderRing(140, 120);
    expect(screen.getByText('RM20')).toBeTruthy();
    expect(screen.getByText('over')).toBeTruthy();
    expect(ring.props.accessibilityLabel).toBe(
      'Transport, RM140.00 of RM120, RM20 over',
    );
    expect(ring.props.accessibilityValue.now).toBe(100);
    fireEvent.press(ring);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('sweeps spent over budget and says what is left, rounded down', () => {
    const { ring } = renderRing(349.8, 450);
    expect(screen.getByText('RM100')).toBeTruthy();
    expect(screen.getByText('left')).toBeTruthy();
    expect(ring.props.accessibilityValue.now).toBe(78);
  });

  it('shows what was spent when the category has no budget yet', () => {
    const { ring } = renderRing(96.5, null);
    expect(screen.getByText('RM96.50')).toBeTruthy();
    expect(screen.getByText('spent')).toBeTruthy();
    expect(ring.props.accessibilityLabel).toBe('Transport, RM96.50 spent, no budget yet');
  });
});
