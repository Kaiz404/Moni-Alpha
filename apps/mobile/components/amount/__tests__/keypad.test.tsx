import { fireEvent, render, screen } from '@testing-library/react-native';

import { Keypad } from '@/components/amount/keypad';
import { keypadTap } from '@/lib/haptics';

jest.mock('uniwind', () => ({
  useCSSVariable: (names: string[]) => names.map(() => undefined),
}));
jest.mock('react-native-reanimated', () => ({
  ...jest.requireActual<object>('react-native-reanimated/mock'),
  useReducedMotion: () => false,
}));
jest.mock('@/lib/haptics', () => ({ keypadTap: jest.fn() }));

function press(name: string) {
  fireEvent.press(screen.getByTestId(`capture.key.${name}`));
}

beforeEach(() => jest.mocked(keypadTap).mockClear());

describe('Keypad', () => {
  it('passes each key that changes the amount, with Keyboard_Tap', () => {
    const onKey = jest.fn();
    render(
      <Keypad
        screen="capture"
        typed="12"
        onKey={onKey}
      />,
    );

    press('3');
    press('point');
    press('back');

    expect(onKey.mock.calls).toEqual([['3'], ['.'], ['back']]);
    expect(keypadTap).toHaveBeenCalledTimes(3);
  });

  it('ignores a third decimal and a second point, without a haptic', () => {
    const onKey = jest.fn();
    render(
      <Keypad
        screen="capture"
        typed="12.50"
        onKey={onKey}
      />,
    );

    press('3');
    press('point');

    expect(onKey).not.toHaveBeenCalled();
    expect(keypadTap).not.toHaveBeenCalled();
    expect(
      screen.getByTestId('capture.key.3').props.accessibilityState,
    ).toMatchObject({ disabled: true });
  });
});
