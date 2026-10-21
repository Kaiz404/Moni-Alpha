import {
  fireEvent,
  render,
  screen,
} from '@testing-library/react-native';

import { Press } from '@/components/ui/press';
import { Text } from '@/components/ui/text';
import { tid } from '@/lib/test-ids';

describe('Press', () => {
  it('runs onPress once after press-in and press-out, under its testID', () => {
    const onPress = jest.fn();
    const onPressIn = jest.fn();
    const onPressOut = jest.fn();
    render(
      <Press
        testID={tid('home', 'recent', 'see-all')}
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
      >
        <Text>See all</Text>
      </Press>,
    );

    const node = screen.getByTestId('home.recent.see-all');
    fireEvent(node, 'pressIn');
    fireEvent(node, 'pressOut');
    fireEvent.press(node);

    expect(onPressIn).toHaveBeenCalledTimes(1);
    expect(onPressOut).toHaveBeenCalledTimes(1);
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(node.props.testID).toBe('home.recent.see-all');
    expect(node.props.accessibilityRole).toBe('button');
  });
});
