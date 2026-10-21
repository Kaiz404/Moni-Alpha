import {
  fireEvent,
  render,
  screen,
} from '@testing-library/react-native';

import { Button } from '@/components/ui/button';
import { tid } from '@/lib/test-ids';

jest.mock('uniwind', () => ({
  useCSSVariable: (names: string[]) => names.map(() => undefined),
}));
jest.mock('@/lib/haptics', () => ({
  approve: jest.fn(),
  notMine: jest.fn(),
}));

describe('Button', () => {
  it('ignores presses while loading and shows the loading label', () => {
    const onPress = jest.fn();
    render(
      <Button
        testID={tid('txn', 'save')}
        label="Save expense"
        loadingLabel="Saving"
        loading
        onPress={onPress}
      />,
    );

    fireEvent.press(screen.getByTestId('txn.save'));

    expect(onPress).not.toHaveBeenCalled();
    expect(screen.getByText('Saving')).toBeTruthy();
    expect(screen.queryByText('Save expense')).toBeNull();
  });

  it('marks a disabled button disabled for accessibility and ignores presses', () => {
    const onPress = jest.fn();
    render(
      <Button
        testID={tid('txn', 'save')}
        label="Save expense"
        disabled
        onPress={onPress}
      />,
    );

    const node = screen.getByTestId('txn.save');
    fireEvent.press(node);

    expect(node.props.accessibilityState.disabled).toBe(true);
    expect(onPress).not.toHaveBeenCalled();
  });

  it('fires the Approve haptic with the press', () => {
    const { approve } = jest.requireMock('@/lib/haptics');
    const onPress = jest.fn();
    render(
      <Button
        testID={tid('review', 'approve')}
        label="Approve"
        variant="approve"
        onPress={onPress}
      />,
    );

    fireEvent.press(screen.getByTestId('review.approve'));

    expect(onPress).toHaveBeenCalledTimes(1);
    expect(approve).toHaveBeenCalledTimes(1);
  });
});
